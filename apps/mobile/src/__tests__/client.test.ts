import { ApiClient, ApiError } from '../api/client';
import type { TokenStore } from '../api/tokenStore';
import type { Tokens } from '../api/types';

interface FakeRes { ok: boolean; status: number; text(): Promise<string>; json(): Promise<unknown> }
const res = (status: number, body: unknown): FakeRes => ({
  ok: status >= 200 && status < 300, status,
  text: async () => JSON.stringify(body), json: async () => body,
});

function memoryStore(initial: Tokens | null): TokenStore & { current: Tokens | null } {
  const s = {
    current: initial,
    get: async () => s.current,
    set: async (t: Tokens) => { s.current = t; },
    clear: async () => { s.current = null; },
  };
  return s;
}

const BASE = 'http://api.test/api';
const authResult = (n: number) => ({ data: { accessToken: `access-${n}`, refreshToken: `refresh-${n}`, user: { id: 'u' } } });

/** Fake server: /auth/refresh rotates single-use refresh tokens; other routes require the *latest* access token. */
function makeServer() {
  let generation = 0; // access-0/refresh-0 are issued at "login"
  const calls = { refresh: 0, data: 0, refreshTokensSeen: [] as string[] };
  const fetchImpl = jest.fn(async (url: string, init?: { headers?: Record<string, string>; body?: string }) => {
    if (url.endsWith('/auth/refresh')) {
      calls.refresh++;
      const sent = JSON.parse(init?.body ?? '{}').refreshToken as string;
      calls.refreshTokensSeen.push(sent);
      await Promise.resolve();
      if (sent !== `refresh-${generation}`) return res(401, { statusCode: 401, message: 'Invalid refresh token' });
      generation++;
      return res(200, authResult(generation));
    }
    calls.data++;
    const auth = init?.headers?.Authorization;
    if (auth !== `Bearer access-${generation}`) return res(401, { statusCode: 401, message: 'Unauthorized' });
    return res(200, { data: { ok: true, token: auth }, meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });
  });
  return { fetchImpl, calls };
}

const make = (initial: Tokens | null, server = makeServer(), onSessionExpired = jest.fn()) => {
  const store = memoryStore(initial);
  const client = new ApiClient({ baseUrl: BASE, store, fetchImpl: server.fetchImpl as unknown as typeof fetch, onSessionExpired });
  return { client, store, server, onSessionExpired };
};

describe('ApiClient', () => {
  it('sends the bearer token and returns data and meta', async () => {
    const { client, server } = make({ accessToken: 'access-0', refreshToken: 'refresh-0' });
    const r = await client.request<{ ok: boolean }>('/expenses', { query: { page: 2, status: 'DRAFT', skip: undefined } });
    expect(r.data.ok).toBe(true);
    expect(r.meta?.total).toBe(1);
    expect(server.fetchImpl.mock.calls[0][0]).toBe(`${BASE}/expenses?page=2&status=DRAFT`);
    expect(server.calls.refresh).toBe(0);
  });

  it('on 401 refreshes once, stores the rotated pair, and retries the request once', async () => {
    const { client, store, server } = make({ accessToken: 'stale', refreshToken: 'refresh-0' });
    const r = await client.request<{ token: string }>('/expenses');
    expect(r.data.token).toBe('Bearer access-1');
    expect(server.calls.refresh).toBe(1);
    expect(server.calls.data).toBe(2); // original + exactly one retry
    expect(store.current).toEqual({ accessToken: 'access-1', refreshToken: 'refresh-1' });
  });

  it('serialises concurrent 401s behind a single in-flight refresh (single-use refresh token)', async () => {
    const { client, store, server } = make({ accessToken: 'stale', refreshToken: 'refresh-0' });
    const results = await Promise.all([
      client.request<{ token: string }>('/a'),
      client.request<{ token: string }>('/b'),
      client.request<{ token: string }>('/c'),
    ]);
    expect(results.map((r) => r.data.token)).toEqual(Array(3).fill('Bearer access-1'));
    expect(server.calls.refresh).toBe(1);
    expect(server.calls.refreshTokensSeen).toEqual(['refresh-0']);
    expect(store.current?.refreshToken).toBe('refresh-1');
  });

  it('does not refresh again when another request already rotated the token', async () => {
    const { client, server } = make({ accessToken: 'access-0', refreshToken: 'refresh-0' });
    await client.refresh('access-0'); // someone else refreshed
    expect(server.calls.refresh).toBe(1);
    const stale = await client.refresh('access-0'); // late 401 from a request that used the old token
    expect(stale.accessToken).toBe('access-1');
    expect(server.calls.refresh).toBe(1);
  });

  it('retries only once: a second 401 surfaces as an ApiError without another refresh', async () => {
    const server = makeServer();
    // Data route always rejects.
    const base = server.fetchImpl.getMockImplementation()!;
    server.fetchImpl.mockImplementation(async (url, init) => (String(url).endsWith('/auth/refresh') ? base(url, init) : res(401, { message: 'nope' })));
    const { client } = make({ accessToken: 'stale', refreshToken: 'refresh-0' }, server);
    await expect(client.request('/expenses')).rejects.toMatchObject({ status: 401 });
    expect(server.calls.refresh).toBe(1);
  });

  it('clears storage and signals expiry once when the refresh is rejected', async () => {
    const { client, store, onSessionExpired } = make({ accessToken: 'stale', refreshToken: 'revoked' });
    const calls = await Promise.allSettled([client.request('/a'), client.request('/b')]);
    expect(calls.every((c) => c.status === 'rejected')).toBe(true);
    expect(store.current).toBeNull();
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('keeps the session when the refresh fails because the network is down', async () => {
    const server = makeServer();
    server.fetchImpl.mockImplementation(async (url) => {
      if (String(url).endsWith('/auth/refresh')) throw new TypeError('Network request failed');
      return res(401, { message: 'expired' });
    });
    const { client, store, onSessionExpired } = make({ accessToken: 'stale', refreshToken: 'refresh-0' }, server);
    await expect(client.request('/expenses')).rejects.toMatchObject({ status: 0 });
    expect(store.current).not.toBeNull();
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('never tries to refresh for anonymous calls such as login', async () => {
    const server = makeServer();
    server.fetchImpl.mockImplementation(async () => res(401, { statusCode: 401, message: 'Invalid credentials' }));
    const { client } = make(null, server);
    await expect(client.request('/auth/login', { method: 'POST', body: { email: 'a@b.c', password: 'x' }, anonymous: true })).rejects.toThrow('Invalid credentials');
    expect(server.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('joins array validation messages and exposes them verbatim', async () => {
    const server = makeServer();
    server.fetchImpl.mockImplementation(async () => res(400, { statusCode: 400, message: ['amount is bad', 'merchant is bad'] }));
    const { client } = make({ accessToken: 'access-0', refreshToken: 'refresh-0' }, server);
    const err = (await client.request('/expenses', { method: 'POST', body: {} }).then(() => null, (e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.messages).toEqual(['amount is bad', 'merchant is bad']);
    expect(err.message).toBe('amount is bad\nmerchant is bad');
  });

  it('maps fetch failures to a network ApiError', async () => {
    const server = makeServer();
    server.fetchImpl.mockImplementation(async () => { throw new TypeError('Network request failed'); });
    const { client } = make({ accessToken: 'access-0', refreshToken: 'refresh-0' }, server);
    const err = (await client.request('/expenses').then(() => null, (e: unknown) => e)) as ApiError;
    expect(err.isNetwork).toBe(true);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, session, setSessionLostHandler } from '../lib/api';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const user = { id: 'u', email: 'a@b.c', firstName: 'A', lastName: 'B', isSuperAdmin: false, organisationId: 'o', role: 'EMPLOYEE' as const };

describe('api client', () => {
  beforeEach(() => { vi.restoreAllMocks(); session.set({ accessToken: 'old', refreshToken: 'r1', user }); });

  it('sends the bearer token and unwraps JSON', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { data: [1] }));
    expect((await api.get('/x')).data).toEqual([1]);
    expect((f.mock.calls[0][1] as RequestInit).headers).toMatchObject({ Authorization: 'Bearer old' });
  });

  it('on 401 refreshes once, stores the rotated pair and retries the request', async () => {
    const f = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(401, { message: 'Unauthorized' }))
      .mockResolvedValueOnce(json(200, { data: { accessToken: 'new', refreshToken: 'r2', user } }))
      .mockResolvedValueOnce(json(200, { data: 'ok' }));
    expect((await api.get('/x')).data).toBe('ok');
    expect(session.get()).toMatchObject({ accessToken: 'new', refreshToken: 'r2' });
    expect((f.mock.calls[2][1] as RequestInit).headers).toMatchObject({ Authorization: 'Bearer new' });
    expect(String(f.mock.calls[1][0])).toContain('/auth/refresh');
  });

  it('concurrent 401s share ONE refresh call (refresh tokens are single-use)', async () => {
    let refreshCalls = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) { refreshCalls++; await new Promise((r) => setTimeout(r, 10)); return json(200, { data: { accessToken: 'new', refreshToken: 'r2', user } }); }
      return (init?.headers as any).Authorization === 'Bearer new' ? json(200, { data: 'ok' }) : json(401, { message: 'no' });
    });
    const rs = await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')]);
    expect(rs.map((r) => r.data)).toEqual(['ok', 'ok', 'ok']);
    expect(refreshCalls).toBe(1);
  });

  it('clears the session and notifies when refresh fails', async () => {
    const lost = vi.fn(); setSessionLostHandler(lost);
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(401, {})).mockResolvedValueOnce(json(401, { message: 'Refresh token reuse detected' }));
    await expect(api.get('/x')).rejects.toMatchObject({ status: 401 });
    expect(session.get()).toBeNull(); expect(lost).toHaveBeenCalled();
  });

  it('surfaces validation messages (array) joined, with status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(400, { message: ['amount must be positive', 'merchant is required'] }));
    const e = await api.post('/expenses', {}).catch((x) => x);
    expect(e).toBeInstanceOf(ApiError); expect(e.status).toBe(400); expect(e.message).toBe('amount must be positive. merchant is required');
  });

  it('reports network failures in plain language', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(api.get('/x')).rejects.toMatchObject({ status: 0, message: expect.stringMatching(/reach the server/) });
  });

  it('does not attempt refresh for unauthenticated calls (login failure stays a 401)', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(401, { message: 'Invalid credentials' }));
    await expect(api.post('/auth/login', {}, { auth: false })).rejects.toMatchObject({ message: 'Invalid credentials' });
    expect(f).toHaveBeenCalledTimes(1);
  });
});

/**
 * Minimal typed API client.
 * - Tokens live in localStorage (SPA tradeoff: readable by XSS; mitigated by a strict CSP in production and short access-token TTL).
 * - On 401 exactly one refresh runs at a time (refresh tokens are single-use/rotating); the original request is retried once.
 */
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000/api';
const KEY = 'spendwise.session';

export interface SessionUser { id: string; email: string; firstName: string; lastName: string; isSuperAdmin: boolean; organisationId: string | null; role: Role | null }
export type Role = 'ORG_ADMIN' | 'FINANCE_MANAGER' | 'EMPLOYEE';
export interface Session { accessToken: string; refreshToken: string; user: SessionUser }
export interface Meta { page: number; pageSize: number; total: number; totalPages: number; unread?: number }
export interface Paged<T> { data: T[]; meta: Meta }

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: string[]) { super(message); }
}

export const session = {
  get(): Session | null { try { const s = localStorage.getItem(KEY); return s ? (JSON.parse(s) as Session) : null; } catch { return null; } },
  set(s: Session) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ } },
  clear() { try { localStorage.removeItem(KEY); } catch { /* noop */ } },
};

type Listener = () => void;
let onSessionLost: Listener = () => {};
export const setSessionLostHandler = (fn: Listener) => { onSessionLost = fn; };

let refreshing: Promise<Session | null> | null = null;
async function refresh(): Promise<Session | null> {
  if (refreshing) return refreshing;
  const cur = session.get();
  if (!cur) return null;
  refreshing = (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: cur.refreshToken }) });
      if (!res.ok) throw new Error('refresh failed');
      const next = (await res.json()).data as Session;
      session.set(next);
      return next;
    } catch {
      session.clear();
      onSessionLost();
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function parse(res: Response) {
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  if (!res.ok) {
    const m = body?.message;
    throw new ApiError(res.status, Array.isArray(m) ? m.join('. ') : (m ?? res.statusText ?? 'Request failed'), Array.isArray(m) ? m : undefined);
  }
  return body;
}

export interface ReqOpts { method?: string; body?: unknown; query?: Record<string, string | number | boolean | undefined | null>; auth?: boolean; form?: FormData; raw?: boolean; headers?: Record<string, string> }

export async function request<T = any>(path: string, opts: ReqOpts = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`.replace(/([^:]\/)\/+/g, '$1'));
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  const send = async (s: Session | null) => {
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    if (!opts.form && opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.auth !== false && s) headers.Authorization = `Bearer ${s.accessToken}`;
    return fetch(url, { method: opts.method ?? (opts.body || opts.form ? 'POST' : 'GET'), headers, body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined) });
  };
  let res: Response;
  try { res = await send(session.get()); } catch { throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.'); }
  if (res.status === 401 && opts.auth !== false) {
    const next = await refresh();
    if (!next) throw new ApiError(401, 'Your session has expired. Please sign in again.');
    res = await send(next);
  }
  if (opts.raw) { if (!res.ok) await parse(res); return res as unknown as T; }
  return (await parse(res)) as T;
}

export const api = {
  get: <T = any>(p: string, query?: ReqOpts['query']) => request<T>(p, { query }),
  post: <T = any>(p: string, body?: unknown, extra: Partial<ReqOpts> = {}) => request<T>(p, { method: 'POST', body: body ?? {}, ...extra }),
  patch: <T = any>(p: string, body: unknown) => request<T>(p, { method: 'PATCH', body }),
  del: <T = any>(p: string) => request<T>(p, { method: 'DELETE' }),
  upload: <T = any>(p: string, file: File) => { const f = new FormData(); f.append('file', file); return request<T>(p, { method: 'POST', form: f }); },
  /** Authenticated binary/CSV download → Blob (the bearer token is never put in a URL). */
  async blob(p: string, query?: ReqOpts['query']): Promise<Blob> { const r = await request<Response>(p, { query, raw: true }); return r.blob(); },
};
export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

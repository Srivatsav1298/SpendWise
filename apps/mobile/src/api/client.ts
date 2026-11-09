import type { ApiErrorBody, AuthResult, PageMeta, Tokens } from './types';
import type { TokenStore } from './tokenStore';

export class ApiError extends Error {
  readonly status: number;
  readonly messages: string[];
  constructor(status: number, messages: string[], fallback = 'Something went wrong') {
    super(messages.length ? messages.join('\n') : fallback);
    this.name = 'ApiError';
    this.status = status;
    this.messages = messages;
  }
  get isNetwork() { return this.status === 0; }
}

export interface ApiResponse<T> { data: T; meta?: PageMeta }

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  form?: FormData;
  headers?: Record<string, string>;
  /** Do not attach the bearer token or attempt refresh (login, refresh, forgot-password). */
  anonymous?: boolean;
}

export interface ClientDeps {
  baseUrl: string;
  store: TokenStore;
  fetchImpl?: typeof fetch;
  /** Called once when the session cannot be recovered (refresh rejected). */
  onSessionExpired?: () => void;
}

function parseMessages(body: unknown, status: number): string[] {
  const b = body as Partial<ApiErrorBody> | null;
  if (b && typeof b === 'object' && b.message !== undefined) {
    return Array.isArray(b.message) ? b.message.map(String) : [String(b.message)];
  }
  return [`Request failed (HTTP ${status})`];
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly store: TokenStore;
  private readonly fetchImpl: typeof fetch;
  private readonly onSessionExpired?: () => void;
  private refreshing: Promise<Tokens> | null = null;

  constructor(deps: ClientDeps) {
    this.baseUrl = deps.baseUrl.replace(/\/+$/, '');
    this.store = deps.store;
    this.fetchImpl = deps.fetchImpl ?? ((...a) => fetch(...a));
    this.onSessionExpired = deps.onSessionExpired;
  }

  url(path: string, query?: RequestOptions['query']): string {
    const qs = query
      ? Object.entries(query)
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join('&')
      : '';
    return `${this.baseUrl}${path}${qs ? `?${qs}` : ''}`;
  }

  async getAccessToken(): Promise<string | null> {
    return (await this.store.get())?.accessToken ?? null;
  }

  async setTokens(t: Tokens): Promise<void> {
    await this.store.set(t);
  }

  async clearTokens(): Promise<void> {
    await this.store.clear();
  }

  private async send(path: string, opts: RequestOptions, token: string | null): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json', ...(opts.headers ?? {}) };
    let body: BodyInit | undefined;
    if (opts.form) {
      body = opts.form; // fetch sets the multipart boundary itself
    } else if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      return await this.fetchImpl(this.url(path, opts.query), { method: opts.method ?? 'GET', headers, body });
    } catch {
      throw new ApiError(0, ['Cannot reach the server. Check your connection and the API URL.']);
    }
  }

  /**
   * Single-flight refresh. `staleAccessToken` is the token the failed request used: if the stored token already
   * differs, another caller has refreshed in the meantime and we reuse it (refresh tokens are single-use).
   */
  refresh(staleAccessToken: string | null): Promise<Tokens> {
    if (this.refreshing) return this.refreshing;
    const run = async (): Promise<Tokens> => {
      const current = await this.store.get();
      if (!current) throw new ApiError(401, ['Not signed in']);
      if (staleAccessToken && current.accessToken !== staleAccessToken) return current;
      let res: Response;
      try {
        res = await this.fetchImpl(this.url('/auth/refresh'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ refreshToken: current.refreshToken }),
        });
      } catch {
        // Offline: keep the session, the refresh token has not been consumed.
        throw new ApiError(0, ['Cannot reach the server. Check your connection and the API URL.']);
      }
      if (!res.ok) {
        if (res.status >= 500) throw new ApiError(res.status, ['The server is unavailable. Try again shortly.']);
        await this.store.clear();
        this.onSessionExpired?.();
        throw new ApiError(401, ['Your session has expired. Please sign in again.']);
      }
      const json = (await res.json()) as ApiResponse<AuthResult>;
      const next: Tokens = { accessToken: json.data.accessToken, refreshToken: json.data.refreshToken };
      await this.store.set(next);
      return next;
    };
    const p = run().finally(() => {
      if (this.refreshing === p) this.refreshing = null;
    });
    this.refreshing = p;
    return p;
  }

  async request<T>(path: string, opts: RequestOptions = {}): Promise<ApiResponse<T>> {
    const token = opts.anonymous ? null : await this.getAccessToken();
    let res = await this.send(path, opts, token);
    if (res.status === 401 && !opts.anonymous && token) {
      const fresh = await this.refresh(token); // throws if the session is gone
      res = await this.send(path, opts, fresh.accessToken); // retry exactly once
    }
    return this.parse<T>(res);
  }

  private async parse<T>(res: Response): Promise<ApiResponse<T>> {
    let json: unknown = null;
    const text = await res.text().catch(() => '');
    if (text) {
      try { json = JSON.parse(text); } catch { json = null; }
    }
    if (!res.ok) throw new ApiError(res.status, parseMessages(json, res.status));
    return (json ?? { data: null }) as ApiResponse<T>;
  }
}

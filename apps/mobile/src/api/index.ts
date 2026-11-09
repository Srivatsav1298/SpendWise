import { API_URL, PAGE_SIZE } from '../config';
import { ApiClient, ApiError, type ApiResponse } from './client';
import { secureTokenStore } from './tokenStore';
import type {
  AppNotification, AuthResult, Card, Dashboard, Expense, ExpenseStatus, Limits, Me, Paged, Profile, Receipt, Transaction,
} from './types';

type Listener = () => void;
const expiredListeners = new Set<Listener>();
export const onSessionExpired = (fn: Listener) => {
  expiredListeners.add(fn);
  return () => { expiredListeners.delete(fn); };
};

export const client = new ApiClient({
  baseUrl: API_URL,
  store: secureTokenStore,
  onSessionExpired: () => expiredListeners.forEach((fn) => fn()),
});

export { ApiError };

const list = async <T,>(path: string, query: Record<string, string | number | undefined>): Promise<Paged<T>> => {
  const r = await client.request<T[]>(path, { query });
  return { data: r.data, meta: r.meta ?? { page: 1, pageSize: r.data.length, total: r.data.length, totalPages: 1 } };
};
const one = async <T,>(p: Promise<ApiResponse<T>>): Promise<T> => (await p).data;

export interface ReceiptUpload { uri: string; name: string; mimeType: string }
export interface ExpenseInput { amount: string; expenseDate: string; category: string; merchant: string; description?: string }

export const api = {
  auth: {
    async login(email: string, password: string): Promise<AuthResult> {
      const r = await client.request<AuthResult>('/auth/login', { method: 'POST', body: { email: email.trim().toLowerCase(), password }, anonymous: true });
      await client.setTokens({ accessToken: r.data.accessToken, refreshToken: r.data.refreshToken });
      return r.data;
    },
    async logout(): Promise<void> {
      const t = await secureTokenStore.get();
      try {
        if (t) await client.request('/auth/logout', { method: 'POST', body: { refreshToken: t.refreshToken }, anonymous: true });
      } catch {
        /* best effort: local sign-out must always succeed */
      } finally {
        await client.clearTokens();
      }
    },
    me: () => one(client.request<Me>('/auth/me')),
    forgotPassword: (email: string) => one(client.request<{ ok: boolean }>('/auth/forgot-password', { method: 'POST', body: { email: email.trim().toLowerCase() }, anonymous: true })),
    hasSession: async () => (await secureTokenStore.get()) !== null,
  },
  dashboard: () => one(client.request<Dashboard>('/reports/dashboard')),
  limits: () => one(client.request<Limits>('/employees/me/limits')),
  expenses: {
    list: (page: number, status?: ExpenseStatus) => list<Expense>('/expenses', { page, pageSize: PAGE_SIZE, status }),
    get: (id: string) => one(client.request<Expense>(`/expenses/${id}`)),
    create: (input: ExpenseInput & { currency: string; submit?: boolean }) => one(client.request<Expense>('/expenses', { method: 'POST', body: input })),
    update: (id: string, input: Partial<ExpenseInput>) => one(client.request<Expense>(`/expenses/${id}`, { method: 'PATCH', body: input })),
    remove: (id: string) => one(client.request<{ ok: boolean }>(`/expenses/${id}`, { method: 'DELETE' })),
    submit: (id: string) => one(client.request<Expense>(`/expenses/${id}/submit`, { method: 'POST' })),
    uploadReceipt(id: string, file: ReceiptUpload) {
      const form = new FormData();
      // React Native's FormData accepts { uri, name, type } file descriptors.
      form.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
      return one(client.request<Receipt>(`/expenses/${id}/receipts`, { method: 'POST', form }));
    },
  },
  transactions: {
    list: (page: number) => list<Transaction>('/transactions', { page, pageSize: PAGE_SIZE }),
    simulate: (input: { cardId: string; amount: string; merchant: string; category: string }, idempotencyKey: string) =>
      one(client.request<Transaction>('/transactions/simulate', { method: 'POST', body: input, headers: { 'Idempotency-Key': idempotencyKey } })),
  },
  cards: {
    list: () => one(client.request<Card[]>('/cards')),
    freeze: (id: string) => one(client.request<Card>(`/cards/${id}/status`, { method: 'POST', body: { status: 'FROZEN' } })),
  },
  notifications: {
    list: (page: number) => list<AppNotification>('/notifications', { page, pageSize: PAGE_SIZE }),
    markRead: (id: string) => one(client.request<unknown>(`/notifications/${id}/read`, { method: 'PATCH' })),
    markAllRead: () => one(client.request<unknown>('/notifications/read-all', { method: 'POST' })),
  },
  users: {
    me: () => one(client.request<Profile>('/users/me')),
    update: (input: { firstName: string; lastName: string }) => one(client.request<Profile>('/users/me', { method: 'PATCH', body: input })),
    changePassword: (currentPassword: string, newPassword: string) =>
      one(client.request<{ ok: boolean }>('/users/me/password', { method: 'POST', body: { currentPassword, newPassword } })),
  },
};

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import Dashboard from '../pages/Dashboard';
import { session } from '../lib/api';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const data = {
  scope: 'organisation', totalSpend: '175017.31', monthSpend: '4283.37',
  budget: { total: '600000.00', spent: '175017.31', available: '424982.69', utilisationPct: 29.17 },
  pendingApprovals: { count: 3, amount: '7599.00' },
  recentTransactions: [{ id: 't1', merchant: 'Casino Oslo', category: 'Gambling', amount: '999.00', status: 'DECLINED', flagged: true, occurredAt: '2026-11-01T10:00:00Z' }],
  byDepartment: [{ key: 'd', label: 'Engineering', total: '94582.19', count: 61 }], monthlyTrend: [{ key: '2026-10', total: '5000.00', count: 4 }], byCategory: [{ key: 'Travel', total: '200.20', count: 1 }], activeBudgets: [],
};
beforeAll(() => { (globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }; });

/** Match a leaf element by text, treating NBSP (used in formatted money) as a plain space. */
const leaf = (text: string) => (_: string, el: Element | null) => !!el && el.children.length === 0 && el.textContent?.replace(/\u00A0/g, ' ') === text;

const mount = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><AuthProvider><Dashboard /></AuthProvider></MemoryRouter></QueryClientProvider>,
);

describe('Dashboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    session.set({ accessToken: 'a', refreshToken: 'r', user: { id: 'u', email: 'a@b.c', firstName: 'Astrid', lastName: 'H', isSuperAdmin: false, organisationId: 'o', role: 'ORG_ADMIN' } });
  });

  it('renders the exact figures returned by the API (no client-side re-computation)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => String(input).includes('/reports/dashboard') ? json(200, { data }) : json(200, { data: { baseCurrency: 'NOK' } }));
    mount();
    expect(await screen.findByText(leaf('175 017,31 NOK'))).toBeInTheDocument();
    expect(screen.getByText(leaf('4 283,37 NOK'))).toBeInTheDocument();
    expect(screen.getByText(leaf('424 982,69 NOK'))).toBeInTheDocument();
    expect(screen.getByText(/29\.17% of/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '29');
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Casino Oslo')).toBeInTheDocument(); expect(screen.getByText('Flagged')).toBeInTheDocument();
  });

  it('shows an error state with retry when the API fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => String(input).includes('/reports/dashboard') ? json(500, { message: 'Internal server error' }) : json(200, { data: { baseCurrency: 'NOK' } }));
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('Internal server error');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('shows empty states when there is no spend', async () => {
    const empty = { ...data, totalSpend: '0.00', monthSpend: '0.00', recentTransactions: [], byDepartment: [], monthlyTrend: [], byCategory: [] };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => String(input).includes('/reports/dashboard') ? json(200, { data: empty }) : json(200, { data: { baseCurrency: 'NOK' } }));
    mount();
    expect(await screen.findByText('No spending in this range')).toBeInTheDocument();
    expect(screen.getByText('No transactions yet')).toBeInTheDocument();
  });
});

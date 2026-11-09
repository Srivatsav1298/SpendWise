import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import { RequireAuth, RequireRole } from '../components/guards';
import { Login } from '../pages/AuthPages';
import { session } from '../lib/api';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const U = { id: 'u', email: 'a@b.c', firstName: 'Ada', lastName: 'L', isSuperAdmin: false, organisationId: 'o', role: 'EMPLOYEE' as const };

const app = (initial = '/login') => render(
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter initialEntries={[initial]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RequireAuth><p>HOME</p></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth><RequireRole roles={['ORG_ADMIN']}><p>ADMIN</p></RequireRole></RequireAuth>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>,
);

describe('authentication flow', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('signs in, stores the session and lands on the protected page', async () => {
    const u = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
      String(input).includes('/auth/login') ? json(200, { data: { accessToken: 'a', refreshToken: 'r', user: U } }) : json(200, { data: { baseCurrency: 'NOK' } }));
    app();
    await u.type(screen.getByLabelText('Email'), 'a@b.c'); await u.type(screen.getByLabelText('Password'), 'Str0ngPassw0rd!');
    await u.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('HOME')).toBeInTheDocument();
    expect(session.get()?.accessToken).toBe('a');
  });

  it('shows the API error on bad credentials and stays on the page', async () => {
    const u = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(401, { message: 'Invalid credentials' }));
    app();
    await u.type(screen.getByLabelText('Email'), 'a@b.c'); await u.type(screen.getByLabelText('Password'), 'wrong');
    await u.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
    expect(session.get()).toBeNull();
  });

  it('validates empty credentials client-side without calling the API', async () => {
    const u = userEvent.setup(); const f = vi.spyOn(globalThis, 'fetch');
    app(); await u.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/enter your email and password/i); expect(f).not.toHaveBeenCalled();
  });

  it('redirects anonymous users to /login, and role-restricted routes bounce employees home', async () => {
    app('/');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('employees cannot open admin-only routes', async () => {
    session.set({ accessToken: 'a', refreshToken: 'r', user: U });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { data: { baseCurrency: 'NOK' } }));
    app('/admin');
    await waitFor(() => expect(screen.getByText('HOME')).toBeInTheDocument());
    expect(screen.queryByText('ADMIN')).not.toBeInTheDocument();
  });
});

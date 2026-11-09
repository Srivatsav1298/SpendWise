import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import { ROLE_LABEL } from '../lib/format';
import { cx } from './ui';

interface Item { to: string; label: string; roles?: ('ORG_ADMIN' | 'FINANCE_MANAGER' | 'EMPLOYEE')[] }
const ITEMS: Item[] = [
  { to: '/', label: 'Dashboard' },
  { to: '/expenses', label: 'Expenses' },
  { to: '/approvals', label: 'Approvals', roles: ['ORG_ADMIN', 'FINANCE_MANAGER'] },
  { to: '/cards', label: 'Cards' },
  { to: '/transactions', label: 'Transactions' },
  { to: '/budgets', label: 'Budgets', roles: ['ORG_ADMIN', 'FINANCE_MANAGER'] },
  { to: '/employees', label: 'People', roles: ['ORG_ADMIN', 'FINANCE_MANAGER'] },
  { to: '/reports', label: 'Reports', roles: ['ORG_ADMIN', 'FINANCE_MANAGER'] },
  { to: '/audit', label: 'Audit log', roles: ['ORG_ADMIN', 'FINANCE_MANAGER'] },
  { to: '/notifications', label: 'Notifications' },
  { to: '/settings', label: 'Settings' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const unread = useQuery({ queryKey: ['notifications', 'unread'], queryFn: () => api.get('/notifications', { pageSize: 1 }), refetchInterval: 60_000, enabled: !!user?.organisationId });
  const count = unread.data?.meta?.unread ?? 0;
  const items = user?.isSuperAdmin && !user.organisationId ? [{ to: '/platform', label: 'Organisations' }] : ITEMS.filter((i) => !i.roles || (user?.role && i.roles.includes(user.role)));

  const links = (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end={i.to === '/'} onClick={() => setOpen(false)}
          className={({ isActive }) => cx('flex items-center justify-between rounded-lg px-3 py-2 text-sm', isActive ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:bg-bg hover:text-ink')}>
          {i.label}
          {i.to === '/notifications' && count > 0 && <span className="rounded-full bg-accent px-2 text-xs text-white" aria-label={`${count} unread`}>{count}</span>}
        </NavLink>
      ))}
    </nav>
  );
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="hidden border-r border-line bg-surface p-4 lg:block">
        <div className="mb-6 px-3 text-lg font-semibold tracking-tight text-accent">SpendWise</div>
        {links}
        <div className="mt-8 border-t border-line px-3 pt-4 text-xs text-muted">
          <p className="truncate font-medium text-ink">{user?.firstName} {user?.lastName}</p>
          <p>{user?.isSuperAdmin ? 'Super admin' : user?.role ? ROLE_LABEL[user.role] : ''}</p>
          <button className="mt-2 text-accent hover:underline" onClick={async () => { await logout(); nav('/login'); }}>Sign out</button>
        </div>
      </aside>
      <div>
        <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
          <span className="font-semibold text-accent">SpendWise</span>
          <button aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="rounded-lg border border-line px-3 py-1.5 text-sm">Menu</button>
        </header>
        {open && <div className="border-b border-line bg-surface p-4 lg:hidden">{links}<button className="mt-3 text-sm text-accent" onClick={async () => { await logout(); nav('/login'); }}>Sign out</button></div>}
        <main className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8"><Outlet /></main>
      </div>
    </div>
  );
}

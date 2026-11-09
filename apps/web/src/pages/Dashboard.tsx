import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../auth/AuthContext';
import { Badge, Card, Empty, ErrorState, Input, PageHeader, ProgressBar, Spinner, Stat, Table, Td, Th } from '../components/ui';
import { api } from '../lib/api';
import { date, money, monthLabel } from '../lib/format';

// Restrained, colour-blind-considerate palette (teal-led, warm neutrals).
const PALETTE = ['#0F5C5A', '#C08A2E', '#5B7C99', '#A3523A', '#7A8F5A', '#8B7BA8', '#8A8A82'];
const n = (s: string) => Number(s); // chart geometry only — never used for money arithmetic

export default function Dashboard() {
  const { currency, isManager, user } = useAuth();
  const [range, setRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const q = useQuery({ queryKey: ['dashboard', range], queryFn: () => api.get('/reports/dashboard', { from: range.from, to: range.to }).then((r) => r.data) });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const trend = d.monthlyTrend.map((m: any) => ({ month: monthLabel(m.key), total: n(m.total) }));
  const cats = d.byCategory.map((c: any) => ({ name: c.key, value: n(c.total) }));
  const depts = d.byDepartment.map((c: any) => ({ name: c.label, total: n(c.total) }));
  const tip = (v: number) => money(v.toFixed(2), currency);

  return (
    <>
      <PageHeader title={`Hello, ${user?.firstName}`} subtitle={d.scope === 'organisation' ? 'Organisation-wide spend, budgets and approvals' : 'Your spending and approvals'}
        action={
          <div className="flex items-end gap-2">
            <div className="w-36"><Input label="From" type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></div>
            <div className="w-36"><Input label="To" type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></div>
          </div>
        } />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total spend" value={money(d.totalSpend, currency)} sub="Approved expenses + card spend in range" />
        <Stat label="This month" value={money(d.monthSpend, currency)} />
        {d.budget ? (
          <Stat label="Available budget" value={money(d.budget.available, currency)} tone={d.budget.utilisationPct >= 90 ? 'bad' : d.budget.utilisationPct >= 75 ? 'warn' : undefined}
            sub={<span className="mt-2 block"><ProgressBar pct={d.budget.utilisationPct} /><span className="mt-1 block">{d.budget.utilisationPct}% of {money(d.budget.total, currency)} used</span></span>} />
        ) : <Stat label="Budget" value="—" sub="Visible to finance & admins" />}
        <Stat label={isManager ? 'Pending approvals' : 'Awaiting approval'} value={d.pendingApprovals.count} sub={money(d.pendingApprovals.amount, currency)} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card title="Monthly spending trend" className="lg:col-span-2">
          {trend.length ? (
            <div className="h-64" role="img" aria-label="Line chart of monthly spending">
              <ResponsiveContainer><LineChart data={trend} margin={{ left: 8, right: 8 }}>
                <CartesianGrid stroke="#E7E4DD" vertical={false} /><XAxis dataKey="month" tickLine={false} fontSize={12} /><YAxis tickLine={false} axisLine={false} fontSize={12} width={64} />
                <Tooltip formatter={(v: number) => tip(v)} /><Line type="monotone" dataKey="total" stroke="#0F5C5A" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart></ResponsiveContainer>
            </div>
          ) : <Empty title="No spending in this range" hint="Approved expenses and card transactions will appear here." />}
        </Card>
        <Card title="By category">
          {cats.length ? (
            <>
              <div className="h-44" role="img" aria-label="Pie chart of spending by category"><ResponsiveContainer><PieChart>
                <Pie data={cats} dataKey="value" nameKey="name" innerRadius={44} outerRadius={72} paddingAngle={2}>{cats.map((_: unknown, i: number) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}</Pie>
                <Tooltip formatter={(v: number) => tip(v)} />
              </PieChart></ResponsiveContainer></div>
              <ul className="mt-2 space-y-1 text-sm">{cats.map((c: any, i: number) => (
                <li key={c.name} className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />{c.name}</span><span className="tabular-nums text-muted">{tip(c.value)}</span></li>
              ))}</ul>
            </>
          ) : <Empty title="No categories yet" />}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {isManager && (
          <Card title="Department spending">
            {depts.length ? (
              <div className="h-60" role="img" aria-label="Bar chart of spending by department"><ResponsiveContainer><BarChart data={depts} layout="vertical" margin={{ left: 16 }}>
                <CartesianGrid stroke="#E7E4DD" horizontal={false} /><XAxis type="number" tickLine={false} fontSize={12} /><YAxis type="category" dataKey="name" tickLine={false} axisLine={false} fontSize={12} width={90} />
                <Tooltip formatter={(v: number) => tip(v)} /><Bar dataKey="total" fill="#0F5C5A" radius={[0, 4, 4, 0]} />
              </BarChart></ResponsiveContainer></div>
            ) : <Empty title="No department data" />}
          </Card>
        )}
        <Card title="Recent transactions" className={isManager ? '' : 'lg:col-span-2'}>
          {d.recentTransactions.length ? (
            <Table><thead><tr><Th>Merchant</Th><Th>Date</Th><Th>Status</Th><Th right>Amount</Th></tr></thead>
              <tbody>{d.recentTransactions.map((t: any) => (
                <tr key={t.id}><Td>{t.merchant}<span className="block text-xs text-muted">{t.category}</span></Td><Td>{date(t.occurredAt)}</Td>
                  <Td><Badge value={t.status} />{t.flagged && <span className="ml-1"><Badge value="FLAGGED" /></span>}</Td><Td right>{money(t.amount, currency)}</Td></tr>
              ))}</tbody></Table>
          ) : <Empty title="No transactions yet" hint="Simulated card payments show up here." />}
        </Card>
      </div>
    </>
  );
}

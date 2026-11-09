import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Button, Card, Empty, ErrorState, Input, PageHeader, Spinner, Table, Td, Th } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { money, monthLabel } from '../lib/format';

const REPORTS = [
  { id: 'monthly', label: 'Monthly spending', col: 'Month' },
  { id: 'departments', label: 'Department spending', col: 'Department' },
  { id: 'employees', label: 'Employee expense report', col: 'Employee' },
  { id: 'categories', label: 'Category analytics', col: 'Category' },
  { id: 'budget-utilisation', label: 'Budget utilisation', col: 'Budget' },
] as const;

export default function Reports() {
  const { currency } = useAuth();
  const [id, setId] = useState<(typeof REPORTS)[number]['id']>('monthly');
  const [range, setRange] = useState({ from: '', to: '' }); const [err, setErr] = useState<string | null>(null);
  const rep = REPORTS.find((r) => r.id === id)!;
  const q = useQuery({ queryKey: ['report', id, range], queryFn: () => api.get(`/reports/${id}`, { ...range }).then((r) => r.data) });
  const download = async () => {
    setErr(null);
    try {
      const blob = await api.blob(`/reports/${id}`, { ...range, format: 'csv' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${id}.csv`; a.click(); URL.revokeObjectURL(url);
    } catch (e) { setErr(errorMessage(e)); }
  };
  return (
    <>
      <PageHeader title="Reports" subtitle="Spend = approved expenses + approved card transactions" action={<Button variant="secondary" onClick={download}>Export CSV</Button>} />
      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div role="tablist" aria-label="Report type" className="flex flex-wrap gap-1">{REPORTS.map((r) => (
            <button key={r.id} role="tab" aria-selected={r.id === id} onClick={() => setId(r.id)} className={`rounded-lg px-3 py-1.5 text-sm ${r.id === id ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:bg-bg'}`}>{r.label}</button>))}</div>
          {id !== 'budget-utilisation' && <div className="ml-auto flex gap-2"><div className="w-36"><Input label="From" type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></div><div className="w-36"><Input label="To" type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></div></div>}
        </div>
      </Card>
      {err && <p role="alert" className="mb-3 text-sm text-bad">{err}</p>}
      <Card>
        {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.data.length === 0 ? <Empty title="No data for this range" /> : id === 'budget-utilisation' ? (
          <Table><thead><tr><Th>Budget</Th><Th>Scope</Th><Th right>Amount</Th><Th right>Spent</Th><Th right>Remaining</Th><Th right>Used</Th></tr></thead><tbody>{q.data.map((b: any) => (
            <tr key={b.id}><Td className="font-medium">{b.name}</Td><Td>{b.department ?? 'Organisation'}</Td><Td right>{money(b.amount, currency)}</Td><Td right>{money(b.spent, currency)}</Td><Td right>{money(b.remaining, currency)}</Td><Td right>{b.utilisationPct}%</Td></tr>))}</tbody></Table>
        ) : (
          <Table><thead><tr><Th>{rep.col}</Th><Th right>Items</Th><Th right>Total</Th></tr></thead><tbody>{q.data.map((r: any) => (
            <tr key={r.key}><Td className="font-medium">{id === 'monthly' ? monthLabel(r.key) : (r.label ?? r.key)}</Td><Td right>{r.count}</Td><Td right>{money(r.total, currency)}</Td></tr>))}</tbody></Table>
        )}
      </Card>
    </>
  );
}

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, Card, Empty, ErrorState, Input, Modal, PageHeader, ProgressBar, Select, Spinner, Table, Td, Th } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { AMOUNT_RE, CATEGORIES, date, money } from '../lib/format';

function BudgetModal({ departments, onClose, onDone }: { departments: any[]; onClose: () => void; onDone: () => void }) {
  const n = new Date();
  const [f, setF] = useState({ name: '', amount: '', departmentId: '', periodStart: new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1)).toISOString().slice(0, 10), periodEnd: new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 0)).toISOString().slice(0, 10) });
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(null);
    if (f.name.trim().length < 2) return setErr('Give the budget a name');
    if (!AMOUNT_RE.test(f.amount) || Number(f.amount) <= 0) return setErr('Enter a positive amount');
    if (f.periodEnd < f.periodStart) return setErr('End date must be on or after the start date');
    setBusy(true);
    try { await api.post('/budgets', { ...f, name: f.name.trim(), departmentId: f.departmentId || undefined }); onDone(); onClose(); } catch (e2) { setErr(errorMessage(e2)); } finally { setBusy(false); }
  };
  return (
    <Modal title="Create budget" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3" noValidate>
        <Input label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Select label="Applies to" value={f.departmentId} onChange={(e) => setF({ ...f, departmentId: e.target.value })}><option value="">Whole organisation</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
        <Input label="Amount" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <div className="grid grid-cols-2 gap-3"><Input label="Start" type="date" value={f.periodStart} onChange={(e) => setF({ ...f, periodStart: e.target.value })} /><Input label="End" type="date" value={f.periodEnd} onChange={(e) => setF({ ...f, periodEnd: e.target.value })} /></div>
        <p className="text-xs text-muted">Approvals and card transactions that would push spend past this amount are blocked. Alerts fire at 75%, 90% and 100%.</p>
        {err && <p role="alert" className="text-sm text-bad">{err}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Create budget</Button></div>
      </form>
    </Modal>
  );
}

function PolicyModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: '', category: '', maxAmountPerExpense: '', requireReceipt: true });
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(null);
    if (f.name.trim().length < 2) return setErr('Give the policy a name');
    if (f.maxAmountPerExpense && !AMOUNT_RE.test(f.maxAmountPerExpense)) return setErr('Maximum must be a decimal amount');
    setBusy(true);
    try { await api.post('/policies', { name: f.name.trim(), category: f.category || undefined, maxAmountPerExpense: f.maxAmountPerExpense || undefined, requireReceipt: f.requireReceipt }); onDone(); onClose(); } catch (e2) { setErr(errorMessage(e2)); } finally { setBusy(false); }
  };
  return (
    <Modal title="New spending policy" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3" noValidate>
        <Input label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Select label="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select>
        <Input label="Maximum per expense / card transaction" inputMode="decimal" value={f.maxAmountPerExpense} onChange={(e) => setF({ ...f, maxAmountPerExpense: e.target.value })} hint="Expenses above this are blocked; card payments above it are flagged" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.requireReceipt} onChange={(e) => setF({ ...f, requireReceipt: e.target.checked })} /> Always require a receipt</label>
        {err && <p role="alert" className="text-sm text-bad">{err}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Create policy</Button></div>
      </form>
    </Modal>
  );
}

export default function Budgets() {
  const { user, currency } = useAuth();
  const isAdmin = user?.role === 'ORG_ADMIN';
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['budgets'], queryFn: () => api.get('/budgets').then((r) => r.data) });
  const pol = useQuery({ queryKey: ['policies'], queryFn: () => api.get('/policies').then((r) => r.data) });
  const deps = useQuery({ queryKey: ['departments'], queryFn: () => api.get('/departments').then((r) => r.data) });
  const [mk, setMk] = useState(false); const [mkPol, setMkPol] = useState(false); const [err, setErr] = useState<string | null>(null);
  const reload = () => { qc.invalidateQueries({ queryKey: ['budgets'] }); qc.invalidateQueries({ queryKey: ['policies'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); };
  const del = async (path: string) => { setErr(null); try { await api.del(path); reload(); } catch (e) { setErr(errorMessage(e)); } };

  return (
    <>
      <PageHeader title="Budgets & policies" subtitle="Backend-enforced spending controls" action={isAdmin ? <div className="flex gap-2"><Button variant="secondary" onClick={() => setMkPol(true)}>New policy</Button><Button onClick={() => setMk(true)}>Create budget</Button></div> : undefined} />
      {err && <p role="alert" className="mb-3 rounded-lg bg-bad-soft p-3 text-sm text-bad">{err}</p>}
      {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.data.length === 0 ? <Card><Empty title="No budgets yet" hint="Create an organisation or department budget to start tracking consumption." /></Card> : (
        <div className="grid gap-4 md:grid-cols-2">
          {q.data.map((b: any) => (
            <Card key={b.id}>
              <div className="flex items-start justify-between gap-2">
                <div><h3 className="font-semibold">{b.name}</h3><p className="text-xs text-muted">{b.department ?? 'Whole organisation'} · {date(b.periodStart)} – {date(b.periodEnd)}</p></div>
                {b.utilisationPct >= 100 ? <Badge value="DECLINED" label="Exhausted" /> : b.utilisationPct >= 90 ? <Badge value="DECLINED" label="≥ 90%" /> : b.utilisationPct >= 75 ? <Badge value="SUBMITTED" label="≥ 75%" /> : <Badge value="ACTIVE" label="On track" />}
              </div>
              <div className="my-4"><ProgressBar pct={b.utilisationPct} /></div>
              <dl className="grid grid-cols-3 gap-2 text-sm">
                <div><dt className="text-xs text-muted">Budget</dt><dd className="tabular-nums">{money(b.amount, currency)}</dd></div>
                <div><dt className="text-xs text-muted">Spent</dt><dd className="tabular-nums">{money(b.spent, currency)}</dd></div>
                <div><dt className="text-xs text-muted">Remaining</dt><dd className="tabular-nums">{money(b.remaining, currency)}</dd></div>
              </dl>
              <div className="mt-3 flex items-center justify-between text-xs text-muted"><span>{b.utilisationPct}% used{b.thresholdsNotified.length ? ` · alerts sent: ${[...b.thresholdsNotified].sort((a: number, c: number) => a - c).join('/')}%` : ''}</span>
                {isAdmin && <button className="text-bad hover:underline" onClick={() => confirm(`Delete budget "${b.name}"?`) && del(`/budgets/${b.id}`)}>Delete</button>}</div>
            </Card>
          ))}
        </div>
      )}
      <Card title="Spending policies" className="mt-6">
        {pol.isLoading ? <Spinner /> : pol.data?.length ? (
          <Table><thead><tr><Th>Policy</Th><Th>Category</Th><Th right>Max per expense</Th><Th>Receipt</Th><Th /></tr></thead><tbody>{pol.data.map((p: any) => (
            <tr key={p.id}><Td className="font-medium">{p.name}</Td><Td>{p.category ?? 'All'}</Td><Td right>{p.maxAmountPerExpense ? money(Number(p.maxAmountPerExpense).toFixed(2), currency) : '—'}</Td><Td>{p.requireReceipt ? 'Required' : 'Optional'}</Td>
              <Td right>{isAdmin && <button className="text-sm text-bad hover:underline" onClick={() => del(`/policies/${p.id}`)}>Remove</button>}</Td></tr>))}</tbody></Table>
        ) : <Empty title="No policies" hint="Policies cap per-expense amounts and require receipts by category." />}
      </Card>
      {mk && <BudgetModal departments={deps.data ?? []} onClose={() => setMk(false)} onDone={reload} />}
      {mkPol && <PolicyModal onClose={() => setMkPol(false)} onDone={reload} />}
    </>
  );
}

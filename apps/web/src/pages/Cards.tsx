import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, Card, Empty, ErrorState, Input, Modal, PageHeader, Select, Spinner } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { AMOUNT_RE, CATEGORIES, money } from '../lib/format';

const SimBadge = () => <span className="rounded border border-warn/40 bg-warn-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warn">Simulated</span>;

function IssueModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const emps = useQuery({ queryKey: ['employees', 'active'], queryFn: () => api.get('/employees', { pageSize: 100, active: true }) });
  const [f, setF] = useState({ employeeId: '', dailyLimit: '', monthlyLimit: '', blocked: '' });
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(null);
    if (!f.employeeId) return setErr('Choose an employee');
    if (!AMOUNT_RE.test(f.dailyLimit) || !AMOUNT_RE.test(f.monthlyLimit)) return setErr('Enter daily and monthly limits as decimal amounts');
    setBusy(true);
    try { await api.post('/cards', { employeeId: f.employeeId, dailyLimit: f.dailyLimit, monthlyLimit: f.monthlyLimit, blockedCategories: f.blocked.split(',').map((s) => s.trim()).filter(Boolean) }); onDone(); onClose(); } catch (e2) { setErr(errorMessage(e2)); } finally { setBusy(false); }
  };
  return (
    <Modal title="Issue simulated virtual card" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3" noValidate>
        <p className="rounded-lg bg-warn-soft p-3 text-xs text-warn">Simulated cards only. No real payment network is used and no real card numbers are stored.</p>
        <Select label="Employee" value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value })}><option value="">Select…</option>{emps.data?.data.map((e: any) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}</Select>
        <div className="grid grid-cols-2 gap-3"><Input label="Daily limit" inputMode="decimal" value={f.dailyLimit} onChange={(e) => setF({ ...f, dailyLimit: e.target.value })} /><Input label="Monthly limit" inputMode="decimal" value={f.monthlyLimit} onChange={(e) => setF({ ...f, monthlyLimit: e.target.value })} /></div>
        <Input label="Restricted categories" placeholder="e.g. Gambling, Alcohol" value={f.blocked} onChange={(e) => setF({ ...f, blocked: e.target.value })} hint="Comma-separated; transactions in these categories are declined" />
        {err && <p role="alert" className="text-sm text-bad">{err}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Issue card</Button></div>
      </form>
    </Modal>
  );
}

function SimulateModal({ card, onClose, onDone }: { card: any; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ amount: '', merchant: '', category: 'Meals' });
  const [res, setRes] = useState<any>(null); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(null); setRes(null);
    if (!AMOUNT_RE.test(f.amount) || Number(f.amount) <= 0) return setErr('Enter a positive amount');
    if (f.merchant.trim().length < 2) return setErr('Enter a merchant');
    setBusy(true);
    try { setRes((await api.post('/transactions/simulate', { cardId: card.id, ...f, merchant: f.merchant.trim() }, { headers: { 'Idempotency-Key': crypto.randomUUID() } })).data); onDone(); } catch (e2) { setErr(errorMessage(e2)); } finally { setBusy(false); }
  };
  return (
    <Modal title={`Simulate payment · ${card.maskedNumber.slice(-4)}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3" noValidate>
        <Input label="Amount" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <Input label="Merchant" value={f.merchant} onChange={(e) => setF({ ...f, merchant: e.target.value })} />
        <Select label="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{[...CATEGORIES, 'Gambling', 'Alcohol'].map((c) => <option key={c}>{c}</option>)}</Select>
        {err && <p role="alert" className="text-sm text-bad">{err}</p>}
        {res && (
          <div role="status" className={`rounded-lg p-3 text-sm ${res.status === 'APPROVED' ? 'bg-ok-soft text-ok' : 'bg-bad-soft text-bad'}`}>
            <b>{res.status === 'APPROVED' ? 'Approved' : 'Declined'}</b>{res.declineReason ? `: ${res.declineReason}` : ''}{res.flagged && res.status === 'APPROVED' ? ` · Flagged: ${res.flagReason}` : ''}
          </div>
        )}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Close</Button><Button type="submit" loading={busy}>Run simulation</Button></div>
      </form>
    </Modal>
  );
}

export default function Cards() {
  const { isManager, currency } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['cards'], queryFn: () => api.get('/cards').then((r) => r.data) });
  const [issue, setIssue] = useState(false); const [sim, setSim] = useState<any | null>(null); const [err, setErr] = useState<string | null>(null);
  const reload = () => { qc.invalidateQueries({ queryKey: ['cards'] }); qc.invalidateQueries({ queryKey: ['transactions'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); };
  const setStatus = async (id: string, status: string) => { setErr(null); try { await api.post(`/cards/${id}/status`, { status }); reload(); } catch (e) { setErr(errorMessage(e)); } };

  return (
    <>
      <PageHeader title="Cards" subtitle="Simulated virtual corporate cards" action={isManager ? <Button onClick={() => setIssue(true)}>Issue card</Button> : undefined} />
      {err && <p role="alert" className="mb-3 rounded-lg bg-bad-soft p-3 text-sm text-bad">{err}</p>}
      {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.data.length === 0 ? <Card><Empty title="No cards yet" hint={isManager ? 'Issue a simulated card to an employee.' : 'Ask your finance team to issue you a card.'} /></Card> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {q.data.map((c: any) => (
            <Card key={c.id}>
              <div className="rounded-xl bg-gradient-to-br from-accent to-[#0b3f3d] p-4 text-white">
                <div className="flex items-center justify-between text-xs"><span>{c.label}</span><SimBadge /></div>
                <p className="mt-6 font-mono text-lg tracking-widest">{c.maskedNumber}</p>
                <div className="mt-4 flex items-end justify-between text-xs"><span>{c.employee.name}</span><Badge value={c.status} /></div>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-y-1 text-sm">
                <dt className="text-muted">Daily limit</dt><dd className="text-right tabular-nums">{money(c.dailyLimit, currency)}</dd>
                <dt className="text-muted">Monthly limit</dt><dd className="text-right tabular-nums">{money(c.monthlyLimit, currency)}</dd>
                <dt className="text-muted">Spent this month</dt><dd className="text-right tabular-nums">{money(c.spentThisMonth, currency)}</dd>
                <dt className="text-muted">Restricted</dt><dd className="text-right">{c.blockedCategories.length ? c.blockedCategories.join(', ') : '—'}</dd>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary" disabled={c.status !== 'ACTIVE'} onClick={() => setSim(c)}>Simulate payment</Button>
                {c.status === 'ACTIVE' && <Button variant="ghost" onClick={() => setStatus(c.id, 'FROZEN')}>Freeze</Button>}
                {isManager && c.status === 'FROZEN' && <Button variant="ghost" onClick={() => setStatus(c.id, 'ACTIVE')}>Unfreeze</Button>}
                {isManager && c.status !== 'DEACTIVATED' && <Button variant="ghost" onClick={() => confirm('Deactivate this card permanently?') && setStatus(c.id, 'DEACTIVATED')}>Deactivate</Button>}
              </div>
            </Card>
          ))}
        </div>
      )}
      {issue && <IssueModal onClose={() => setIssue(false)} onDone={reload} />}
      {sim && <SimulateModal card={sim} onClose={() => setSim(null)} onDone={reload} />}
    </>
  );
}

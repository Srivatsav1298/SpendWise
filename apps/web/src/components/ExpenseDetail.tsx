import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api, errorMessage } from '../lib/api';
import { date, dateTime, money } from '../lib/format';
import { ApprovalActions } from './ApprovalActions';
import { ExpenseForm } from './ExpenseForm';
import { Badge, Button, ErrorState, Modal, Spinner } from './ui';

function Receipt({ id, name, mime }: { id: string; name: string; mime: string }) {
  const [url, setUrl] = useState<string | null>(null); const [err, setErr] = useState(false);
  useEffect(() => {
    let revoke: string | null = null; let alive = true;
    api.blob(`/receipts/${id}`).then((b) => { if (!alive) return; revoke = URL.createObjectURL(b); setUrl(revoke); }).catch(() => alive && setErr(true));
    return () => { alive = false; if (revoke) URL.revokeObjectURL(revoke); };
  }, [id]);
  if (err) return <p className="text-xs text-bad">Could not load {name}</p>;
  if (!url) return <p className="text-xs text-muted">Loading {name}…</p>;
  return mime === 'application/pdf'
    ? <a href={url} target="_blank" rel="noreferrer" className="text-sm text-accent underline">{name} (PDF)</a>
    : <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Receipt ${name}`} className="h-24 rounded-lg border border-line object-cover" /></a>;
}

export function ExpenseDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { user, currency, isManager } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['expense', id], queryFn: () => api.get(`/expenses/${id}`).then((r) => r.data) });
  const [editing, setEditing] = useState(false); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['approvals'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['expense', id] }); };
  const act = async (fn: () => Promise<unknown>, close = false) => {
    setError(null); setBusy(true);
    try { await fn(); refresh(); if (close) onClose(); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const e = q.data;
  const mine = e && e.employee.userId === user?.id;
  return (
    <Modal title="Expense" onClose={onClose} wide>
      {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} /> : editing ? (
        <ExpenseForm currency={currency} initial={{ id: e.id, amount: e.amount, expenseDate: e.expenseDate.slice(0, 10), category: e.category, merchant: e.merchant, description: e.description ?? '' }} onDone={() => { setEditing(false); refresh(); }} />
      ) : (
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-2xl font-semibold tabular-nums">{money(e.amount, e.currency)}</p><p className="text-sm text-muted">{e.merchant} · {e.category} · {date(e.expenseDate)}</p></div>
            <Badge value={e.status} />
          </div>
          <p className="text-sm text-muted">Submitted by {e.employee.name}{e.employee.department ? ` · ${e.employee.department}` : ''}</p>
          {e.description && <p className="text-sm">{e.description}</p>}
          <div>
            <h3 className="mb-2 text-sm font-semibold">Receipts</h3>
            {e.receipts.length ? <div className="flex flex-wrap gap-3">{e.receipts.map((r: any) => <Receipt key={r.id} id={r.id} name={r.originalName} mime={r.mimeType} />)}</div> : <p className="text-sm text-muted">No receipts attached.</p>}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Approval history</h3>
            {e.approvals.length ? (
              <ol className="space-y-2 border-l border-line pl-4">{e.approvals.map((a: any) => (
                <li key={a.id} className="text-sm"><Badge value={a.decision} /> <span className="text-muted">{dateTime(a.createdAt)}</span>{a.comment && <p className="mt-1">{a.comment}</p>}</li>
              ))}</ol>
            ) : <p className="text-sm text-muted">No decisions yet.</p>}
          </div>
          {error && <p role="alert" className="rounded-lg bg-bad-soft p-3 text-sm text-bad">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
            {mine && (e.status === 'DRAFT' || e.status === 'REJECTED') && (<>
              {e.status === 'DRAFT' && <Button variant="ghost" disabled={busy} onClick={() => act(() => api.del(`/expenses/${id}`), true)}>Delete</Button>}
              <Button variant="secondary" disabled={busy} onClick={() => setEditing(true)}>Edit</Button>
              <Button loading={busy} onClick={() => act(() => api.post(`/expenses/${id}/submit`))}>{e.status === 'REJECTED' ? 'Resubmit' : 'Submit'}</Button>
            </>)}
            {isManager && !mine && e.status === 'SUBMITTED' && <ApprovalActions expenseId={id} onDone={() => { refresh(); onClose(); }} />}
            {isManager && !mine && e.status === 'APPROVED' && <Button loading={busy} onClick={() => act(() => api.post(`/approvals/${id}/reimburse`, {}))}>Mark reimbursed</Button>}
          </div>
        </div>
      )}
    </Modal>
  );
}

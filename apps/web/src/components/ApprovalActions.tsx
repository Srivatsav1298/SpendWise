import { useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { Button, Modal, Textarea } from './ui';

/** Approve / reject (reason required) for a SUBMITTED expense; surfaces server-side rule failures (budget, self-approval). */
export function ApprovalActions({ expenseId, onDone }: { expenseId: string; onDone: () => void }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);

  const run = async (kind: 'approve' | 'reject') => {
    setError(null);
    if (kind === 'reject' && reason.trim().length < 3) return setError('A rejection reason is required (at least 3 characters)');
    setBusy(kind);
    try {
      await api.post(`/approvals/${expenseId}/${kind}`, kind === 'reject' ? { reason: reason.trim() } : {});
      setRejecting(false); onDone();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(null); }
  };
  return (
    <>
      <div className="flex gap-2">
        <Button loading={busy === 'approve'} disabled={!!busy} onClick={() => run('approve')}>Approve</Button>
        <Button variant="secondary" disabled={!!busy} onClick={() => { setError(null); setRejecting(true); }}>Reject</Button>
      </div>
      {error && !rejecting && <p role="alert" className="mt-2 text-sm text-bad">{error}</p>}
      {rejecting && (
        <Modal title="Reject expense" onClose={() => setRejecting(false)}>
          <Textarea label="Reason (sent to the employee)" value={reason} onChange={(e) => setReason(e.target.value)} />
          {error && <p role="alert" className="mt-2 text-sm text-bad">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRejecting(false)}>Cancel</Button>
            <Button variant="danger" loading={busy === 'reject'} onClick={() => run('reject')}>Reject expense</Button>
          </div>
        </Modal>
      )}
    </>
  );
}

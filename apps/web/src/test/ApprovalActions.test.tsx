import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApprovalActions } from '../components/ApprovalActions';
import { api } from '../lib/api';

vi.mock('../lib/api', async (orig) => ({ ...(await orig<typeof import('../lib/api')>()), api: { post: vi.fn() } }));
const post = (api as unknown as { post: ReturnType<typeof vi.fn> }).post;

describe('ApprovalActions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('approves via the API and notifies the parent', async () => {
    const u = userEvent.setup(); const done = vi.fn(); post.mockResolvedValue({});
    render(<ApprovalActions expenseId="e1" onDone={done} />);
    await u.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(post).toHaveBeenCalledWith('/approvals/e1/approve', {});
  });

  it('requires a rejection reason before calling the API', async () => {
    const u = userEvent.setup(); const done = vi.fn();
    render(<ApprovalActions expenseId="e1" onDone={done} />);
    await u.click(screen.getByRole('button', { name: 'Reject' }));
    const dlg = screen.getByRole('dialog');
    await u.click(within(dlg).getByRole('button', { name: /reject expense/i }));
    expect(within(dlg).getByRole('alert')).toHaveTextContent(/reason is required/i);
    expect(post).not.toHaveBeenCalled();
    await u.type(within(dlg).getByLabelText(/reason/i), 'Missing project code');
    post.mockResolvedValue({});
    await u.click(within(dlg).getByRole('button', { name: /reject expense/i }));
    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(post).toHaveBeenCalledWith('/approvals/e1/reject', { reason: 'Missing project code' });
  });

  it('shows backend refusals (budget exceeded / self-approval) and does not call onDone', async () => {
    const u = userEvent.setup(); const done = vi.fn();
    post.mockRejectedValue(new Error('Approving would exceed budget "Engineering" (remaining 10.00 NOK)'));
    render(<ApprovalActions expenseId="e1" onDone={done} />);
    await u.click(screen.getByRole('button', { name: 'Approve' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/exceed budget "Engineering"/);
    expect(done).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled(); // can retry/reject instead
  });
});

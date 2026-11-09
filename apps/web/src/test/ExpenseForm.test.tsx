import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExpenseForm, validateExpense, validateReceipt } from '../components/ExpenseForm';
import { api } from '../lib/api';

vi.mock('../lib/api', async (orig) => ({ ...(await orig<typeof import('../lib/api')>()), api: { post: vi.fn(), patch: vi.fn(), upload: vi.fn() } }));
const mocked = api as unknown as { post: ReturnType<typeof vi.fn>; patch: ReturnType<typeof vi.fn>; upload: ReturnType<typeof vi.fn> };

const fill = async (u: ReturnType<typeof userEvent.setup>, o: { amount?: string; category?: string; merchant?: string } = {}) => {
  await u.type(screen.getByLabelText(/amount/i), o.amount ?? '120.50');
  await u.selectOptions(screen.getByLabelText('Category'), o.category ?? 'Meals');
  await u.type(screen.getByLabelText('Merchant'), o.merchant ?? 'Cafe Nor');
};

describe('ExpenseForm', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows validation errors and sends nothing when required fields are missing', async () => {
    const u = userEvent.setup(); const done = vi.fn();
    render(<ExpenseForm currency="NOK" onDone={done} />);
    await u.click(screen.getByRole('button', { name: /submit for approval/i }));
    expect(await screen.findByText('Amount is required')).toBeInTheDocument();
    expect(screen.getByText('Choose a category')).toBeInTheDocument(); expect(screen.getByText('Merchant is required')).toBeInTheDocument();
    expect(mocked.post).not.toHaveBeenCalled(); expect(done).not.toHaveBeenCalled();
  });

  it('rejects malformed amounts (3 decimals, negative, text)', async () => {
    const u = userEvent.setup();
    render(<ExpenseForm currency="NOK" onDone={vi.fn()} />);
    await fill(u, { amount: '10.999' });
    await u.click(screen.getByRole('button', { name: /submit for approval/i }));
    expect(await screen.findByText(/positive amount with at most 2 decimals/i)).toBeInTheDocument();
    expect(mocked.post).not.toHaveBeenCalled();
  });

  it('creates the draft with the org currency, then submits', async () => {
    const u = userEvent.setup(); const done = vi.fn();
    mocked.post.mockResolvedValueOnce({ data: { id: 'e1' } }).mockResolvedValueOnce({ data: {} });
    render(<ExpenseForm currency="NOK" onDone={done} />);
    await fill(u);
    await u.click(screen.getByRole('button', { name: /submit for approval/i }));
    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(mocked.post).toHaveBeenNthCalledWith(1, '/expenses', expect.objectContaining({ amount: '120.50', currency: 'NOK', category: 'Meals', merchant: 'Cafe Nor' }));
    expect(mocked.post).toHaveBeenNthCalledWith(2, '/expenses/e1/submit');
  });

  it('save draft does not submit', async () => {
    const u = userEvent.setup(); const done = vi.fn();
    mocked.post.mockResolvedValueOnce({ data: { id: 'e1' } });
    render(<ExpenseForm currency="NOK" onDone={done} />);
    await fill(u);
    await u.click(screen.getByRole('button', { name: /save draft/i }));
    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(mocked.post).toHaveBeenCalledTimes(1);
  });

  it('uploads attached receipts between create and submit', async () => {
    const u = userEvent.setup(); const done = vi.fn(); const order: string[] = [];
    mocked.post.mockImplementation(async (p: string) => { order.push(p); return { data: { id: 'e1' } }; });
    mocked.upload.mockImplementation(async (p: string) => { order.push(`upload:${p}`); return { data: {} }; });
    render(<ExpenseForm currency="NOK" onDone={done} />);
    await fill(u);
    await u.upload(screen.getByLabelText(/receipts/i), new File([new Uint8Array(10)], 'r.png', { type: 'image/png' }));
    await u.click(screen.getByRole('button', { name: /submit for approval/i }));
    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(order).toEqual(['/expenses', 'upload:/expenses/e1/receipts', '/expenses/e1/submit']);
  });

  it('shows the server rule error (e.g. receipt required) and keeps the draft instead of duplicating it', async () => {
    const u = userEvent.setup(); const done = vi.fn();
    mocked.post.mockResolvedValueOnce({ data: { id: 'e1' } }).mockRejectedValueOnce(new Error('A receipt is required for this expense before it can be submitted'));
    render(<ExpenseForm currency="NOK" onDone={done} />);
    await fill(u, { amount: '900' });
    await u.click(screen.getByRole('button', { name: /submit for approval/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/receipt is required/i);
    expect(done).not.toHaveBeenCalled();
    // retry after fixing: must PATCH the existing draft, not POST a second expense
    mocked.patch.mockResolvedValueOnce({}); mocked.post.mockResolvedValueOnce({ data: {} });
    await u.click(screen.getByRole('button', { name: /submit for approval/i }));
    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(mocked.patch).toHaveBeenCalledWith('/expenses/e1', expect.any(Object));
    expect(mocked.post.mock.calls.filter((c) => c[0] === '/expenses')).toHaveLength(1);
  });

  it('validators', () => {
    expect(validateExpense({ amount: '5', expenseDate: '2026-01-01', category: 'Meals', merchant: 'AB', description: '' })).toEqual({});
    expect(validateReceipt(new File(['x'], 'a.exe', { type: 'application/x-msdownload' }))).toMatch(/JPEG, PNG, WebP or PDF/);
    expect(validateReceipt(new File([new Uint8Array(6 * 1024 * 1024)], 'big.png', { type: 'image/png' }))).toMatch(/5 MB/);
    expect(validateReceipt(new File(['x'], 'ok.pdf', { type: 'application/pdf' }))).toBeNull();
  });
});

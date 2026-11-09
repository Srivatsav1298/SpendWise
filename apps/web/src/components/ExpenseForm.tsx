import { FormEvent, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { CATEGORIES, isPositiveAmount } from '../lib/format';
import { Button, Input, Select, Textarea } from './ui';

export interface ExpenseDraft { id?: string; amount: string; expenseDate: string; category: string; merchant: string; description: string }
const today = () => new Date().toISOString().slice(0, 10);
export const MAX_FILE = 5 * 1024 * 1024;
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export function validateExpense(f: ExpenseDraft) {
  const e: Record<string, string> = {};
  if (!f.amount) e.amount = 'Amount is required';
  else if (!isPositiveAmount(f.amount)) e.amount = 'Enter a positive amount with at most 2 decimals';
  if (!f.expenseDate) e.expenseDate = 'Date is required';
  if (!f.category) e.category = 'Choose a category';
  if (f.merchant.trim().length < 2) e.merchant = 'Merchant is required';
  return e;
}
export function validateReceipt(file: File): string | null {
  if (!OK_TYPES.includes(file.type)) return 'Receipts must be JPEG, PNG, WebP or PDF';
  if (file.size > MAX_FILE) return 'Receipt must be 5 MB or smaller';
  return null;
}

/** Create or edit an expense. Flow: save draft → upload receipts → submit (server enforces receipt rules). */
export function ExpenseForm({ currency, initial, onDone }: { currency: string; initial?: ExpenseDraft; onDone: () => void }) {
  const [f, setF] = useState<ExpenseDraft>(initial ?? { amount: '', expenseDate: today(), category: '', merchant: '', description: '' });
  const [files, setFiles] = useState<File[]>([]);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'draft' | 'submit'>(null);
  const set = (k: keyof ExpenseDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const onFiles = (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    for (const p of picked) { const m = validateReceipt(p); if (m) { setErrs({ ...errs, receipt: `${p.name}: ${m}` }); return; } }
    setErrs((x) => { const { receipt: _r, ...rest } = x; return rest; });
    setFiles((cur) => [...cur, ...picked].slice(0, 5));
  };

  const save = async (submit: boolean) => {
    setError(null);
    const v = validateExpense(f); setErrs(v);
    if (Object.keys(v).length) return;
    setBusy(submit ? 'submit' : 'draft');
    let id = f.id;
    try {
      const body = { amount: f.amount, expenseDate: f.expenseDate, category: f.category, merchant: f.merchant.trim(), description: f.description.trim() || undefined };
      if (id) await api.patch(`/expenses/${id}`, body);
      else id = (await api.post('/expenses', { ...body, currency })).data.id;
      for (const file of files) await api.upload(`/expenses/${id}/receipts`, file);
      if (submit) await api.post(`/expenses/${id}/submit`);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      // The draft exists even if a later step failed; keep editing it instead of creating duplicates.
      if (id && !f.id) setF((cur) => ({ ...cur, id }));
      setFiles([]);
    } finally { setBusy(null); }
  };
  const submit = (e: FormEvent) => { e.preventDefault(); void save(true); };

  return (
    <form onSubmit={submit} className="space-y-3" noValidate aria-label="Expense form">
      <div className="grid grid-cols-2 gap-3">
        <Input label={`Amount (${currency})`} inputMode="decimal" value={f.amount} onChange={set('amount')} error={errs.amount} placeholder="0.00" />
        <Input label="Date" type="date" value={f.expenseDate} onChange={set('expenseDate')} error={errs.expenseDate} max={today()} />
      </div>
      <Select label="Category" value={f.category} onChange={set('category')} error={errs.category}>
        <option value="">Select…</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}
      </Select>
      <Input label="Merchant" value={f.merchant} onChange={set('merchant')} error={errs.merchant} />
      <Textarea label="Description (optional)" value={f.description} onChange={set('description')} maxLength={1000} />
      <div>
        <label htmlFor="receipt" className="mb-1 block text-xs font-medium text-muted">Receipts (JPEG, PNG, WebP or PDF · max 5 MB)</label>
        <input id="receipt" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => onFiles(e.target.files)} className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-1.5" />
        {errs.receipt && <p role="alert" className="mt-1 text-xs text-bad">{errs.receipt}</p>}
        {files.length > 0 && <ul className="mt-2 text-xs text-muted">{files.map((x, i) => <li key={i}>{x.name} · {(x.size / 1024).toFixed(0)} KB</li>)}</ul>}
      </div>
      {error && <p role="alert" className="rounded-lg bg-bad-soft p-3 text-sm text-bad">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" loading={busy === 'draft'} disabled={!!busy} onClick={() => void save(false)}>Save draft</Button>
        <Button type="submit" loading={busy === 'submit'} disabled={!!busy}>Submit for approval</Button>
      </div>
    </form>
  );
}

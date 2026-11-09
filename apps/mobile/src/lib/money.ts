import { DEFAULT_CURRENCY } from '../config';

/** Money is always a decimal string ("123.45"). Never do arithmetic with floats on it. */
export type MoneyString = string;

export const AMOUNT_RE = /^\d{1,12}(\.\d{1,2})?$/;

/** Accepts "1234", "1234.5", "1234.50"; rejects zero, negatives, >2 decimals, >12 integer digits. */
export function isValidAmount(value: string): boolean {
  return AMOUNT_RE.test(value) && /[1-9]/.test(value);
}

/** Lets users on comma-decimal keyboards type "12,50"; strips spaces. */
export function normaliseAmountInput(raw: string): string {
  return raw.trim().replace(/\s+/g, '').replace(',', '.');
}

const DECIMAL_RE = /^-?\d+(\.\d+)?$/;

function groupDigits(int: string): string {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Exact string-based fallback formatter (no floats). */
function manualFormat(value: string, currency: string): string {
  const neg = value.startsWith('-');
  const abs = neg ? value.slice(1) : value;
  const [int, frac = ''] = abs.split('.');
  const out = `${groupDigits(int)},${(frac + '00').slice(0, 2)}`;
  return `${neg ? '-' : ''}${out} ${currency}`;
}

/** Display-only formatting of a decimal string. Falls back to an exact string formatter if Intl is unavailable. */
export function formatMoney(value: MoneyString | null | undefined, currency: string = DEFAULT_CURRENCY): string {
  if (value === null || value === undefined || !DECIMAL_RE.test(value)) return '–';
  try {
    const nf = new Intl.NumberFormat('nb-NO', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    // Intl.NumberFormat v3 accepts decimal strings (exact); older engines coerce to Number, which is fine for display.
    return nf.format(value as unknown as number);
  } catch {
    return manualFormat(value, currency);
  }
}

/** Display-only ratio 0..1 for progress bars. Not used for any money arithmetic. */
export function ratio(part: MoneyString | null | undefined, whole: MoneyString | null | undefined): number {
  if (!part || !whole || !DECIMAL_RE.test(part) || !DECIMAL_RE.test(whole)) return 0;
  const w = Number(whole);
  if (!(w > 0)) return 0;
  return Math.max(0, Math.min(1, Number(part) / w));
}

/** Money arrives as decimal strings and is only ever formatted for display, never used in float arithmetic. */
export function money(v: string | null | undefined, currency = 'NOK'): string {
  if (v === null || v === undefined || v === '') return '—';
  const [int, frac = '00'] = v.split('.');
  const neg = int.startsWith('-');
  const digits = int.replace('-', '');
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${neg ? '−' : ''}${grouped},${frac.padEnd(2, '0').slice(0, 2)} ${currency}`;
}
export const AMOUNT_RE = /^\d{1,12}(\.\d{1,2})?$/;
export const isPositiveAmount = (s: string) => AMOUNT_RE.test(s) && Number(s) > 0;
export const date = (d: string | Date) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
export const dateTime = (d: string | Date) => new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
export const monthLabel = (ym: string) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' });
export const CATEGORIES = ['Travel', 'Meals', 'Software', 'Equipment', 'Marketing', 'Office', 'Other'];
export const ROLE_LABEL: Record<string, string> = { ORG_ADMIN: 'Organisation admin', FINANCE_MANAGER: 'Finance manager', EMPLOYEE: 'Employee' };

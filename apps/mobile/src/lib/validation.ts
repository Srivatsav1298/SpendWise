import { CATEGORIES } from '../config';
import { isRealISODate, todayISO } from './dates';
import { isValidAmount, normaliseAmountInput } from './money';

export interface ExpenseFormValues {
  amount: string;
  expenseDate: string;
  category: string;
  merchant: string;
  description: string;
}
export type ExpenseFormErrors = Partial<Record<keyof ExpenseFormValues, string>>;

export function validateExpenseForm(v: ExpenseFormValues, today: string = todayISO(), categories: readonly string[] = CATEGORIES): ExpenseFormErrors {
  const e: ExpenseFormErrors = {};
  const amount = normaliseAmountInput(v.amount);
  if (!amount) e.amount = 'Enter an amount.';
  else if (!isValidAmount(amount)) e.amount = 'Use a positive amount with at most 2 decimals, e.g. 249.50.';

  const date = v.expenseDate.trim();
  if (!date) e.expenseDate = 'Enter the expense date.';
  else if (!isRealISODate(date)) e.expenseDate = 'Use the format YYYY-MM-DD, e.g. 2026-11-08.';
  else if (date > today) e.expenseDate = 'The date cannot be in the future.';

  if (!categories.includes(v.category)) e.category = 'Choose a category.';

  const merchant = v.merchant.trim();
  if (merchant.length < 2) e.merchant = 'Merchant must be at least 2 characters.';
  else if (merchant.length > 120) e.merchant = 'Merchant must be at most 120 characters.';

  if (v.description.trim().length > 1000) e.description = 'Description must be at most 1000 characters.';
  return e;
}

/** Payload with normalised values, ready for POST/PATCH. */
export function toExpensePayload(v: ExpenseFormValues, forUpdate = false) {
  const description = v.description.trim();
  return {
    amount: normaliseAmountInput(v.amount),
    expenseDate: v.expenseDate.trim(),
    category: v.category,
    merchant: v.merchant.trim(),
    ...(description || forUpdate ? { description } : {}),
  };
}

export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{10,128}$/;

export function validateNewPassword(pw: string): string | undefined {
  if (!PASSWORD_RULE.test(pw)) return 'Use 10-128 characters with at least one letter and one digit.';
  return undefined;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (s: string) => EMAIL_RE.test(s.trim());

/** Receipt constraints enforced by the API; checked client-side for a friendlier message. */
export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
export const ALLOWED_RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

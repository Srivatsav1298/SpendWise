import { ExpenseStatus } from '@prisma/client';
import { D, Money } from '../common/money';
import { Prisma } from '@prisma/client';

export const EDITABLE: ExpenseStatus[] = [ExpenseStatus.DRAFT, ExpenseStatus.REJECTED];

export const canEdit = (s: ExpenseStatus) => EDITABLE.includes(s);
export const canSubmit = (s: ExpenseStatus) => EDITABLE.includes(s);
export const canDecide = (s: ExpenseStatus) => s === ExpenseStatus.SUBMITTED;
export const canReimburse = (s: ExpenseStatus) => s === ExpenseStatus.APPROVED;

/** Approvers must never decide their own expenses (compared by user id, not by role). */
export const isSelfApproval = (actorUserId: string, expenseOwnerUserId: string) => actorUserId === expenseOwnerUserId;

export function requiresReceipt(amount: Prisma.Decimal.Value, threshold: Prisma.Decimal.Value, policyRequires: boolean): boolean {
  return D(amount).gte(threshold) || policyRequires;
}

export interface LimitCheck { ok: boolean; remaining: Money | null }
/** limit === null means unlimited. */
export function checkEmployeeLimit(spentThisMonth: Prisma.Decimal.Value, amount: Prisma.Decimal.Value, limit: Prisma.Decimal.Value | null): LimitCheck {
  if (limit === null || limit === undefined) return { ok: true, remaining: null };
  const remaining = D(limit).minus(spentThisMonth);
  return { ok: D(spentThisMonth).plus(amount).lte(limit), remaining: remaining.isNegative() ? D(0) : remaining };
}

export const monthRange = (d: Date) => ({
  start: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)),
  end: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)),
});

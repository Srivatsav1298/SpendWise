import { CardStatus, Prisma } from '@prisma/client';
import { D } from '../common/money';

export interface CardEvalInput {
  status: CardStatus;
  currency: string;
  dailyLimit: Prisma.Decimal.Value;
  monthlyLimit: Prisma.Decimal.Value;
  blockedCategories: string[];
  amount: Prisma.Decimal.Value;
  currencyOfTxn: string;
  category: string;
  spentToday: Prisma.Decimal.Value;
  spentThisMonth: Prisma.Decimal.Value;
  employeeMonthlyLimit?: Prisma.Decimal.Value | null;
  employeeSpentThisMonth?: Prisma.Decimal.Value;
  policyMaxForCategory?: Prisma.Decimal.Value | null;
}
export interface CardEvalResult { approved: boolean; declineReason?: string; flagged: boolean; flagReason?: string }

const norm = (s: string) => s.trim().toLowerCase();

/** Deterministic policy evaluation. Declines are always flagged; approved-but-suspicious spend is flagged too. */
export function evaluateCardTransaction(i: CardEvalInput): CardEvalResult {
  const amount = D(i.amount);
  const decline = (declineReason: string): CardEvalResult => ({ approved: false, declineReason, flagged: true, flagReason: declineReason });
  if (amount.lte(0)) return decline('Invalid amount');
  if (i.status !== CardStatus.ACTIVE) return decline(`Card is ${i.status.toLowerCase()}`);
  if (i.currencyOfTxn.toUpperCase() !== i.currency.toUpperCase()) return decline('Currency mismatch');
  if (i.blockedCategories.map(norm).includes(norm(i.category))) return decline(`Category "${i.category}" is restricted for this card`);
  if (D(i.spentToday).plus(amount).gt(i.dailyLimit)) return decline('Daily limit exceeded');
  if (D(i.spentThisMonth).plus(amount).gt(i.monthlyLimit)) return decline('Monthly limit exceeded');
  if (i.employeeMonthlyLimit !== null && i.employeeMonthlyLimit !== undefined &&
      D(i.employeeSpentThisMonth ?? 0).plus(amount).gt(i.employeeMonthlyLimit)) return decline('Employee monthly limit exceeded');

  if (i.policyMaxForCategory !== null && i.policyMaxForCategory !== undefined && amount.gt(i.policyMaxForCategory)) {
    return { approved: true, flagged: true, flagReason: `Exceeds policy maximum of ${D(i.policyMaxForCategory).toFixed(2)} for ${i.category}` };
  }
  // Large relative to remaining daily allowance (>= 80% of the daily limit in one swipe).
  if (amount.gte(D(i.dailyLimit).times('0.8'))) return { approved: true, flagged: true, flagReason: 'Single transaction uses 80%+ of daily limit' };
  return { approved: true, flagged: false };
}

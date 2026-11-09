import { D, Money, pct } from '../common/money';
import { Prisma } from '@prisma/client';

export const THRESHOLDS = [75, 90, 100] as const;

export function utilisation(spent: Prisma.Decimal.Value, budget: Prisma.Decimal.Value): Money {
  return pct(spent, budget);
}

/** Spending exactly up to the budget is allowed; one cent over is not. */
export function exceedsBudget(spent: Prisma.Decimal.Value, amount: Prisma.Decimal.Value, budget: Prisma.Decimal.Value): boolean {
  return D(spent).plus(amount).greaterThan(budget);
}

/** Thresholds newly crossed by moving from `spentBefore` to `spentAfter`, excluding ones already notified. */
export function newlyCrossedThresholds(
  spentBefore: Prisma.Decimal.Value,
  spentAfter: Prisma.Decimal.Value,
  budget: Prisma.Decimal.Value,
  alreadyNotified: number[] = [],
): number[] {
  const b = D(budget);
  if (b.lte(0)) return [];
  return THRESHOLDS.filter((t) => {
    const limit = b.times(t).div(100);
    return D(spentBefore).lessThan(limit) && D(spentAfter).gte(limit) && !alreadyNotified.includes(t);
  });
}

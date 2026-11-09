import { Prisma } from '@prisma/client';

export type Money = Prisma.Decimal;
export const D = (v: Prisma.Decimal.Value): Money => new Prisma.Decimal(v);
export const ZERO = D(0);

export function sum(values: Prisma.Decimal.Value[]): Money {
  return values.reduce<Money>((acc, v) => acc.plus(v), ZERO);
}
/** Serialise money for API output: fixed 2dp string, never a JS float. */
export function fmt(v: Prisma.Decimal.Value | null | undefined): string | null {
  return v === null || v === undefined ? null : D(v).toFixed(2);
}
/** Percentage (0-100, 2dp) of part over whole; 0 when whole is zero. */
export function pct(part: Prisma.Decimal.Value, whole: Prisma.Decimal.Value): Money {
  const w = D(whole);
  return w.isZero() ? ZERO : D(part).div(w).times(100).toDecimalPlaces(2);
}

import { describe, expect, it } from 'vitest';
import { isPositiveAmount, money, monthLabel } from '../lib/format';

describe('money formatting', () => {
  it('formats decimal strings without float conversion (no precision loss on huge values)', () => {
    expect(money('1234567.89', 'NOK')).toBe('1 234 567,89 NOK');
    expect(money('999999999999.99', 'NOK')).toBe('999 999 999 999,99 NOK');
    expect(money('5', 'NOK')).toBe('5,00 NOK');
    expect(money('0.10', 'NOK')).toBe('0,10 NOK');
  });
  it('handles negatives and empties', () => {
    expect(money('-1500.5')).toBe('−1 500,50 NOK');
    expect(money(null)).toBe('—');
  });
  it('validates positive amounts with at most 2 decimals', () => {
    for (const ok of ['1', '0.01', '12.5', '999999999999.99']) expect(isPositiveAmount(ok)).toBe(true);
    for (const bad of ['0', '0.00', '-1', '1.234', 'abc', '', '1e3', '1,5']) expect(isPositiveAmount(bad)).toBe(false);
  });
  it('labels months in UTC', () => expect(monthLabel('2026-01')).toMatch(/Jan/));
});

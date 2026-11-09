import { D, fmt, pct, sum } from './money';

describe('money', () => {
  it('adds decimals without floating-point error', () => {
    expect(sum(['0.1', '0.2']).toFixed(2)).toBe('0.30'); // 0.1 + 0.2 !== 0.3 in IEEE-754
    expect(D('1234567.89').plus('0.01').toFixed(2)).toBe('1234567.90');
  });
  it('formats to a fixed 2dp string, null-safe', () => {
    expect(fmt('5')).toBe('5.00');
    expect(fmt(null)).toBeNull();
  });
  it('computes percentages safely', () => {
    expect(pct('75', '100').toNumber()).toBe(75);
    expect(pct('1', '3').toNumber()).toBe(33.33);
    expect(pct('10', '0').toNumber()).toBe(0);
  });
});

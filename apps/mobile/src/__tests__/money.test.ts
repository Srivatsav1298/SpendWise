import { formatMoney, isValidAmount, normaliseAmountInput, ratio } from '../lib/money';

const plain = (s: string) => s.replace(/[  ]/g, ' ');

describe('isValidAmount', () => {
  it.each(['1', '0.01', '123.45', '123456789012', '999999999999.99', '10.5'])('accepts %s', (v) => expect(isValidAmount(v)).toBe(true));
  it.each(['', '0', '0.0', '0.00', '-1', '1.234', '1234567890123', 'abc', '1,50', ' 5', '5.', '.5', '1e3'])('rejects %j', (v) => expect(isValidAmount(v)).toBe(false));
});

describe('normaliseAmountInput', () => {
  it('turns a decimal comma into a dot and strips whitespace', () => {
    expect(normaliseAmountInput(' 1 234,50 ')).toBe('1234.50');
  });
  it('leaves already-normalised input alone', () => expect(normaliseAmountInput('12.5')).toBe('12.5'));
});

describe('formatMoney', () => {
  it('formats NOK with grouping and two decimals', () => {
    const out = plain(formatMoney('1234.5', 'NOK'));
    expect(out).toMatch(/1 234,50/);
    expect(out).toMatch(/kr|NOK/);
  });
  it('does not lose precision on large decimal strings beyond display needs', () => {
    expect(plain(formatMoney('999999999999.99', 'NOK'))).toMatch(/999 999 999 999,99|1 000 000 000 000,00/);
  });
  it('returns a dash for null, undefined and malformed input', () => {
    expect(formatMoney(null)).toBe('–');
    expect(formatMoney(undefined)).toBe('–');
    expect(formatMoney('12abc')).toBe('–');
  });
  it('falls back to exact string formatting for an unknown currency code', () => {
    const out = plain(formatMoney('1234.5', 'XX'));
    expect(out).toMatch(/1 234,50/);
  });
});

describe('ratio (display only)', () => {
  it('computes and clamps', () => {
    expect(ratio('5000.00', '20000.00')).toBeCloseTo(0.25);
    expect(ratio('30000.00', '20000.00')).toBe(1);
  });
  it('is zero for missing or zero denominator', () => {
    expect(ratio('10.00', null)).toBe(0);
    expect(ratio('10.00', '0.00')).toBe(0);
  });
});

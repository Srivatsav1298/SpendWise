import { evaluateCardTransaction, CardEvalInput } from './card-rules';

const base: CardEvalInput = {
  status: 'ACTIVE', currency: 'NOK', dailyLimit: '1000', monthlyLimit: '5000', blockedCategories: ['Gambling'],
  amount: '100', currencyOfTxn: 'NOK', category: 'Meals', spentToday: '0', spentThisMonth: '0',
};

describe('card transaction evaluation', () => {
  it('approves a normal transaction without flag', () => expect(evaluateCardTransaction(base)).toEqual({ approved: true, flagged: false }));
  it.each(['FROZEN', 'DEACTIVATED'] as const)('declines %s cards', (status) => {
    const r = evaluateCardTransaction({ ...base, status });
    expect(r.approved).toBe(false); expect(r.flagged).toBe(true);
  });
  it('declines restricted categories (case-insensitive)', () => {
    expect(evaluateCardTransaction({ ...base, category: 'gambling' }).declineReason).toMatch(/restricted/);
  });
  it('enforces daily limit inclusively', () => {
    expect(evaluateCardTransaction({ ...base, spentToday: '900', amount: '100' }).approved).toBe(true);
    expect(evaluateCardTransaction({ ...base, spentToday: '900', amount: '100.01' }).declineReason).toBe('Daily limit exceeded');
  });
  it('enforces monthly limit', () => {
    expect(evaluateCardTransaction({ ...base, dailyLimit: '5000', spentThisMonth: '4950', amount: '100' }).declineReason).toBe('Monthly limit exceeded');
  });
  it('enforces employee monthly limit', () => {
    expect(evaluateCardTransaction({ ...base, employeeMonthlyLimit: '500', employeeSpentThisMonth: '450' }).declineReason).toBe('Employee monthly limit exceeded');
  });
  it('declines currency mismatch and non-positive amounts', () => {
    expect(evaluateCardTransaction({ ...base, currencyOfTxn: 'USD' }).declineReason).toBe('Currency mismatch');
    expect(evaluateCardTransaction({ ...base, amount: '0' }).approved).toBe(false);
  });
  it('approves-but-flags spend above a policy maximum', () => {
    const r = evaluateCardTransaction({ ...base, amount: '300', policyMaxForCategory: '200' });
    expect(r.approved).toBe(true); expect(r.flagged).toBe(true); expect(r.flagReason).toMatch(/policy maximum/);
  });
  it('flags a single transaction using 80%+ of the daily limit', () => {
    expect(evaluateCardTransaction({ ...base, amount: '800' }).flagged).toBe(true);
  });
});

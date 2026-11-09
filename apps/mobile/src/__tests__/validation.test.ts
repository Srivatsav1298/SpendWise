import { validateExpenseForm, toExpensePayload, validateNewPassword, type ExpenseFormValues } from '../lib/validation';
import { isRealISODate } from '../lib/dates';

const TODAY = '2026-11-09';
const ok: ExpenseFormValues = { amount: '249.50', expenseDate: '2026-11-08', category: 'Meals', merchant: 'Fuglen', description: '' };

describe('validateExpenseForm', () => {
  it('passes a valid form', () => expect(validateExpenseForm(ok, TODAY)).toEqual({}));

  it('rejects bad amounts', () => {
    for (const amount of ['', '0', '0.00', '-5', '12.345', 'abc']) {
      expect(validateExpenseForm({ ...ok, amount }, TODAY).amount).toBeDefined();
    }
  });
  it('accepts a decimal comma', () => expect(validateExpenseForm({ ...ok, amount: '12,50' }, TODAY).amount).toBeUndefined());

  it('validates dates: format, real calendar date, not in the future', () => {
    expect(validateExpenseForm({ ...ok, expenseDate: '08/11/2026' }, TODAY).expenseDate).toBeDefined();
    expect(validateExpenseForm({ ...ok, expenseDate: '2026-02-30' }, TODAY).expenseDate).toBeDefined();
    expect(validateExpenseForm({ ...ok, expenseDate: '2026-11-10' }, TODAY).expenseDate).toMatch(/future/);
    expect(validateExpenseForm({ ...ok, expenseDate: TODAY }, TODAY).expenseDate).toBeUndefined();
  });

  it('requires a listed category', () => {
    expect(validateExpenseForm({ ...ok, category: '' }, TODAY).category).toBeDefined();
    expect(validateExpenseForm({ ...ok, category: 'Yachts' }, TODAY).category).toBeDefined();
    expect(validateExpenseForm({ ...ok, category: 'Yachts' }, TODAY, ['Yachts']).category).toBeUndefined();
  });

  it('enforces merchant and description length', () => {
    expect(validateExpenseForm({ ...ok, merchant: ' a ' }, TODAY).merchant).toBeDefined();
    expect(validateExpenseForm({ ...ok, merchant: 'x'.repeat(121) }, TODAY).merchant).toBeDefined();
    expect(validateExpenseForm({ ...ok, description: 'x'.repeat(1001) }, TODAY).description).toBeDefined();
  });

  it('reports every field at once on an empty form', () => {
    const e = validateExpenseForm({ amount: '', expenseDate: '', category: '', merchant: '', description: '' }, TODAY);
    expect(Object.keys(e).sort()).toEqual(['amount', 'category', 'expenseDate', 'merchant']);
  });
});

describe('toExpensePayload', () => {
  it('normalises and omits an empty description on create', () => {
    expect(toExpensePayload({ ...ok, amount: '12,5', merchant: '  Fuglen ' })).toEqual({ amount: '12.5', expenseDate: '2026-11-08', category: 'Meals', merchant: 'Fuglen' });
  });
  it('sends an empty description on update so it can be cleared', () => {
    expect(toExpensePayload(ok, true)).toHaveProperty('description', '');
  });
});

describe('validateNewPassword', () => {
  it('matches the API rule (10+ chars, letter and digit)', () => {
    expect(validateNewPassword('short1')).toBeDefined();
    expect(validateNewPassword('onlyletterslong')).toBeDefined();
    expect(validateNewPassword('1234567890123')).toBeDefined();
    expect(validateNewPassword('Spendwise123!')).toBeUndefined();
  });
});

describe('isRealISODate', () => {
  it('handles leap years', () => {
    expect(isRealISODate('2028-02-29')).toBe(true);
    expect(isRealISODate('2027-02-29')).toBe(false);
  });
});

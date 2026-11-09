import { canDecide, canEdit, canReimburse, canSubmit, checkEmployeeLimit, isSelfApproval, monthRange, requiresReceipt } from './expense-rules';

describe('expense rules', () => {
  it('only DRAFT and REJECTED are editable/submittable', () => {
    expect(canEdit('DRAFT')).toBe(true); expect(canEdit('REJECTED')).toBe(true);
    for (const s of ['SUBMITTED', 'APPROVED', 'REIMBURSED'] as const) { expect(canEdit(s)).toBe(false); expect(canSubmit(s)).toBe(false); }
  });
  it('only SUBMITTED can be decided; only APPROVED can be reimbursed', () => {
    expect(canDecide('SUBMITTED')).toBe(true); expect(canDecide('APPROVED')).toBe(false); expect(canDecide('DRAFT')).toBe(false);
    expect(canReimburse('APPROVED')).toBe(true); expect(canReimburse('SUBMITTED')).toBe(false);
  });
  it('detects self approval by user id', () => { expect(isSelfApproval('u1', 'u1')).toBe(true); expect(isSelfApproval('u1', 'u2')).toBe(false); });
  it('requires receipt at/above threshold or by policy', () => {
    expect(requiresReceipt('499.99', '500', false)).toBe(false);
    expect(requiresReceipt('500', '500', false)).toBe(true);
    expect(requiresReceipt('10', '500', true)).toBe(true);
  });
  describe('employee limit', () => {
    it('allows up to the limit', () => expect(checkEmployeeLimit('900', '100', '1000').ok).toBe(true));
    it('blocks over the limit and reports remaining', () => {
      const r = checkEmployeeLimit('900', '100.01', '1000');
      expect(r.ok).toBe(false); expect(r.remaining?.toFixed(2)).toBe('100.00');
    });
    it('null limit means unlimited', () => expect(checkEmployeeLimit('1e9', '1', null)).toEqual({ ok: true, remaining: null }));
  });
  it('monthRange covers first to last day (UTC), incl. leap February', () => {
    const r = monthRange(new Date('2024-02-15T12:00:00Z'));
    expect(r.start.toISOString().slice(0, 10)).toBe('2024-02-01'); expect(r.end.toISOString().slice(0, 10)).toBe('2024-02-29');
  });
});

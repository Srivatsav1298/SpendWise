import { exceedsBudget, newlyCrossedThresholds, utilisation } from './budget-rules';

describe('budget rules', () => {
  it('allows spending exactly up to the budget but not one cent over', () => {
    expect(exceedsBudget('900.00', '100.00', '1000.00')).toBe(false);
    expect(exceedsBudget('900.00', '100.01', '1000.00')).toBe(true);
  });
  it('computes utilisation', () => expect(utilisation('450', '600').toNumber()).toBe(75));
  it('fires 75/90/100 thresholds as they are crossed', () => {
    expect(newlyCrossedThresholds('0', '740', '1000')).toEqual([]);
    expect(newlyCrossedThresholds('740', '750', '1000')).toEqual([75]);
    expect(newlyCrossedThresholds('0', '950', '1000')).toEqual([75, 90]);
    expect(newlyCrossedThresholds('950', '1000', '1000')).toEqual([100]);
  });
  it('never re-fires a threshold already notified', () => {
    expect(newlyCrossedThresholds('700', '800', '1000', [75])).toEqual([]);
  });
  it('handles zero budget', () => expect(newlyCrossedThresholds('0', '10', '0')).toEqual([]));
});

import { INestApplication } from '@nestjs/common';
import { api, auth, createApp, createOrg, Actor, Org, PNG, submitExpense, today } from './helpers';

const period = () => {
  const n = new Date();
  return { periodStart: new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1)).toISOString().slice(0, 10), periodEnd: new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 0)).toISOString().slice(0, 10) };
};

describe('Budgets, spending controls & card simulation (e2e)', () => {
  let app: INestApplication; let prisma: any; let org: Org;
  beforeAll(async () => { ({ app, prisma } = await createApp()); });
  beforeEach(async () => { org = await createOrg(app); });
  afterAll(() => app.close());

  const budget = (amount: string, departmentId?: string) =>
    api(app).post('/api/budgets').set(auth(org.admin)).send({ name: 'Dept budget', amount, departmentId, ...period() }).expect(201);
  const card = async (daily = '1000', monthly = '5000', blocked: string[] = [], who = org.employee) =>
    (await api(app).post('/api/cards').set(auth(org.admin)).send({ employeeId: who.employeeId, dailyLimit: daily, monthlyLimit: monthly, blockedCategories: blocked }).expect(201)).body.data;
  const swipe = (cardId: string, amount: string, extra: Record<string, unknown> = {}, who = org.employee, key?: string) => {
    const r = api(app).post('/api/transactions/simulate').set(auth(who));
    if (key) r.set('Idempotency-Key', key);
    return r.send({ cardId, amount, merchant: 'Coffee Co', category: 'Meals', ...extra });
  };

  /** Submit an expense of any size (attaches a receipt first so the receipt rule never gets in the way). */
  const withReceipt = async (who: Actor, amount: string, category = 'Software') => {
    const d = await api(app).post('/api/expenses').set(auth(who)).send({ amount, currency: 'NOK', expenseDate: today(), category, merchant: 'Vendor' }).expect(201);
    await api(app).post(`/api/expenses/${d.body.data.id}/receipts`).set(auth(who)).attach('file', PNG, { filename: 'r.png' }).expect(201);
    return api(app).post(`/api/expenses/${d.body.data.id}/submit`).set(auth(who));
  };

  describe('budget enforcement on expense approval', () => {
    it('blocks an approval that would exceed the budget, allows exact fit, then blocks one cent more', async () => {
      await budget('300.00', org.departmentId);
      const a = await submitExpense(app, org.employee, '200.00'); const b = await submitExpense(app, org.employee2, '100.00'); const c = await submitExpense(app, org.employee2, '0.01');
      await api(app).post(`/api/approvals/${a.body.data.id}/approve`).set(auth(org.finance)).send({}).expect(201);
      await api(app).post(`/api/approvals/${b.body.data.id}/approve`).set(auth(org.finance)).send({}).expect(201); // exactly 300.00 = 100%
      const over = await api(app).post(`/api/approvals/${c.body.data.id}/approve`).set(auth(org.finance)).send({});
      expect(over.status).toBe(422); expect(over.body.message).toMatch(/exceed budget "Dept budget"/);
      const still = await api(app).get(`/api/expenses/${c.body.data.id}`).set(auth(org.finance)).expect(200);
      expect(still.body.data.status).toBe('SUBMITTED'); // untouched, can be rejected instead
      const bud = (await api(app).get('/api/budgets').set(auth(org.admin)).expect(200)).body.data[0];
      expect(bud).toMatchObject({ amount: '300.00', spent: '300.00', remaining: '0.00', utilisationPct: 100 });
    });

    it('creates 75 / 90 / 100 % alerts exactly once each, for admins and finance', async () => {
      await budget('1000.00', org.departmentId);
      for (const amt of ['700.00', '60.00', '150.00', '90.00']) { // 700→70% | 760→76% | 910→91% | 1000→100%
        const s = await withReceipt(org.employee2, amt);
        expect(s.status).toBe(201);
        await api(app).post(`/api/approvals/${s.body.data.id}/approve`).set(auth(org.finance)).send({}).expect(201);
      }
      const notes = await api(app).get('/api/notifications?pageSize=50').set(auth(org.finance)).expect(200);
      const alerts = notes.body.data.filter((n: any) => /Budget alert/.test(n.title)).map((n: any) => n.title);
      expect(alerts.sort()).toEqual(['Budget alert: Dept budget at 100%', 'Budget alert: Dept budget at 75%', 'Budget alert: Dept budget at 90%']);
    });
  });

  describe('simulated cards', () => {
    it('issues a clearly-labelled simulated card with no real card data', async () => {
      const c = await card();
      expect(c).toMatchObject({ simulated: true, status: 'ACTIVE', currency: 'NOK', dailyLimit: '1000.00', monthlyLimit: '5000.00' });
      expect(c.maskedNumber).toMatch(/^•••• •••• •••• \d{4}$/); expect(c.label).toMatch(/SIMULATED/);
      expect(Object.keys(c)).not.toEqual(expect.arrayContaining(['cvv', 'pan', 'number', 'expiry']));
      await api(app).post('/api/cards').set(auth(org.admin)).send({ employeeId: org.employee.employeeId, dailyLimit: '500', monthlyLimit: '100' }).expect(400); // daily > monthly
    });

    it('approved swipes update spending records, dashboards and card spend', async () => {
      const c = await card();
      const t = await swipe(c.id, '120.50').expect(201);
      expect(t.body.data).toMatchObject({ status: 'APPROVED', amount: '120.50', flagged: false, simulated: true });
      const cards = await api(app).get('/api/cards').set(auth(org.employee)).expect(200);
      expect(cards.body.data[0].spentThisMonth).toBe('120.50');
      const dash = await api(app).get('/api/reports/dashboard').set(auth(org.admin)).expect(200);
      expect(dash.body.data.monthSpend).toBe('120.50');
      expect(dash.body.data.recentTransactions[0]).toMatchObject({ merchant: 'Coffee Co', amount: '120.50' });
      const lim = await api(app).get('/api/employees/me/limits').set(auth(org.employee)).expect(200);
      expect(lim.body.data).toMatchObject({ monthlyLimit: '10000.00', spentThisMonth: '120.50', remaining: '9879.50' });
    });

    it('declines: daily limit, restricted category, frozen card, wrong currency — declines are recorded & flagged, never counted', async () => {
      const c = await card('500', '5000', ['Gambling']);
      await swipe(c.id, '450').expect(201);
      const daily = await swipe(c.id, '100').expect(201);
      expect(daily.body.data).toMatchObject({ status: 'DECLINED', declineReason: 'Daily limit exceeded', flagged: true });
      const cat = await swipe(c.id, '10', { category: 'gambling' }).expect(201);
      expect(cat.body.data.declineReason).toMatch(/restricted/);
      const cur = await swipe(c.id, '10', { currency: 'USD' }).expect(201);
      expect(cur.body.data.declineReason).toBe('Currency mismatch');
      await api(app).post(`/api/cards/${c.id}/status`).set(auth(org.finance)).send({ status: 'FROZEN' }).expect(201);
      expect((await swipe(c.id, '1').expect(201)).body.data.declineReason).toMatch(/frozen/);
      await api(app).post(`/api/cards/${c.id}/status`).set(auth(org.finance)).send({ status: 'ACTIVE' }).expect(201);
      expect((await swipe(c.id, '1').expect(201)).body.data.status).toBe('APPROVED');
      const cards = await api(app).get('/api/cards').set(auth(org.employee)).expect(200);
      expect(cards.body.data[0].spentThisMonth).toBe('451.00'); // 450 + 1; declines excluded
      const flagged = await api(app).get('/api/transactions?flagged=true').set(auth(org.finance)).expect(200);
      expect(flagged.body.data.length).toBeGreaterThanOrEqual(4);
      const notes = await api(app).get('/api/notifications').set(auth(org.finance)).expect(200);
      expect(notes.body.data.some((n: any) => /Flagged card transaction/.test(n.title))).toBe(true);
    });

    it('enforces the employee monthly limit across expenses + card spend combined', async () => {
      const c = await card('20000', '20000'); // card limits are generous; the employee's own monthly limit (10000) is what binds
      await swipe(c.id, '9000').expect(201); // flagged (80%+ of daily) but approved
      const r = await swipe(c.id, '1500').expect(201);
      expect(r.body.data.declineReason).toBe('Employee monthly limit exceeded');
      const e = await withReceipt(org.employee, '1200.00', 'Travel'); // 9000 + 1200 > 10000
      expect(e.status).toBe(422);
    });

    it('flags (but approves) spend above a category policy maximum', async () => {
      await api(app).post('/api/policies').set(auth(org.admin)).send({ name: 'Meals cap', category: 'Meals', maxAmountPerExpense: '200.00', requireReceipt: false }).expect(201);
      const c = await card('5000', '5000');
      const t = await swipe(c.id, '300').expect(201);
      expect(t.body.data).toMatchObject({ status: 'APPROVED', flagged: true }); expect(t.body.data.flagReason).toMatch(/policy maximum/);
      const e = await api(app).post('/api/expenses').set(auth(org.employee)).send({ amount: '250.00', currency: 'NOK', expenseDate: today(), category: 'Meals', merchant: 'Fancy', submit: true });
      expect(e.status).toBe(422); expect(e.body.message).toMatch(/Meals cap/);
    });

    it('declines card transactions that would breach a department budget', async () => {
      await budget('500.00', org.departmentId);
      const c = await card('5000', '5000');
      await swipe(c.id, '400', { category: 'Software' }).expect(201).then((r) => expect(r.body.data.status).toBe('APPROVED'));
      const r = await swipe(c.id, '150', { category: 'Software' }).expect(201);
      expect(r.body.data).toMatchObject({ status: 'DECLINED', flagged: true }); expect(r.body.data.declineReason).toMatch(/Budget "Dept budget" exceeded/);
    });

    it('is idempotent on Idempotency-Key: replay returns the original and creates nothing new', async () => {
      const c = await card();
      const first = await swipe(c.id, '50', {}, org.employee, 'key-1').expect(201);
      const again = await swipe(c.id, '50', {}, org.employee, 'key-1').expect(201);
      expect(again.body.data.id).toBe(first.body.data.id); expect(again.body.data.replayed).toBe(true);
      const parallel = await Promise.all([1, 2, 3, 4].map(() => swipe(c.id, '10', {}, org.employee, 'key-par')));
      expect(new Set(parallel.map((p) => p.body.data.id)).size).toBe(1);
      expect(await prisma.transaction.count({ where: { cardId: c.id } })).toBe(2);
    });

    it('concurrent swipes cannot jointly breach the daily limit', async () => {
      const c = await card('1000', '5000');
      const rs = await Promise.all(Array.from({ length: 8 }, () => swipe(c.id, '200')));
      const approved = rs.filter((r) => r.body.data.status === 'APPROVED').length;
      expect(rs.every((r) => r.status === 201)).toBe(true);
      expect(approved).toBe(5); // 5 x 200 = 1000 exactly; the other 3 are declined
      const sum = await prisma.transaction.aggregate({ _sum: { amount: true }, where: { cardId: c.id, status: 'APPROVED' } });
      expect(sum._sum.amount.toFixed(2)).toBe('1000.00');
    });

    it('concurrent approvals cannot jointly breach a budget', async () => {
      await budget('250.00', org.departmentId);
      const subs = await Promise.all(['100.00', '100.00', '100.00'].map((a, i) => submitExpense(app, i % 2 ? org.employee2 : org.employee, a)));
      const rs = await Promise.all(subs.map((s) => api(app).post(`/api/approvals/${s.body.data.id}/approve`).set(auth(org.finance)).send({})));
      expect(rs.map((r) => r.status).sort()).toEqual([201, 201, 422]);
    });

    it('permissions: employees only see/use their own cards; only managers can issue, edit, unfreeze or deactivate', async () => {
      const mine = await card(); const theirs = await card('1000', '5000', [], org.employee2);
      await api(app).get(`/api/cards/${theirs.id}`).set(auth(org.employee)).expect(404);
      await swipe(theirs.id, '10', {}, org.employee).expect(404);
      await api(app).patch(`/api/cards/${mine.id}`).set(auth(org.employee)).send({ dailyLimit: '99999' }).expect(403);
      await api(app).post(`/api/cards/${mine.id}/status`).set(auth(org.employee)).send({ status: 'FROZEN' }).expect(201); // self-freeze OK
      await api(app).post(`/api/cards/${mine.id}/status`).set(auth(org.employee)).send({ status: 'ACTIVE' }).expect(403); // unfreeze is manager-only
      await api(app).post(`/api/cards/${mine.id}/status`).set(auth(org.admin)).send({ status: 'DEACTIVATED' }).expect(201);
      await api(app).post(`/api/cards/${mine.id}/status`).set(auth(org.admin)).send({ status: 'ACTIVE' }).expect(400); // terminal
      const txs = await api(app).get('/api/transactions').set(auth(org.employee)).expect(200);
      expect(txs.body.data.every((t: any) => t.employeeId === org.employee.employeeId)).toBe(true);
    });

    it('writes audit log entries for financial operations', async () => {
      const c = await card(); await swipe(c.id, '25').expect(201);
      const s = await submitExpense(app, org.employee2, '40.00');
      await api(app).post(`/api/approvals/${s.body.data.id}/approve`).set(auth(org.finance)).send({}).expect(201);
      const logs = await api(app).get('/api/audit-logs?pageSize=100').set(auth(org.admin)).expect(200);
      const actions = new Set(logs.body.data.map((l: any) => l.action));
      for (const a of ['CARD_ISSUED', 'CARD_TXN_APPROVED', 'EXPENSE_SUBMITTED', 'EXPENSE_APPROVED']) expect(actions.has(a)).toBe(true);
    });
  });
});

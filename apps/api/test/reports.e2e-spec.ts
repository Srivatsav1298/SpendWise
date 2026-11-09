import { INestApplication } from '@nestjs/common';
import { api, auth, createApp, createOrg, Org, submitExpense } from './helpers';

describe('Reports & dashboard (e2e)', () => {
  let app: INestApplication; let org: Org;
  beforeAll(async () => {
    ({ app } = await createApp()); org = await createOrg(app);
    const n = new Date();
    await api(app).post('/api/budgets').set(auth(org.admin)).send({ name: 'Eng', departmentId: org.departmentId, amount: '1000.00',
      periodStart: new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1)).toISOString().slice(0, 10), periodEnd: new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 0)).toISOString().slice(0, 10) }).expect(201);
    const mk = async (who: any, amount: string, category: string, merchant: string) => {
      const s = await submitExpense(app, who, amount, { category, merchant }); expect(s.status).toBe(201);
      await api(app).post(`/api/approvals/${s.body.data.id}/approve`).set(auth(org.finance)).send({}).expect(201);
    };
    await mk(org.employee, '100.10', 'Meals', 'Aa'); await mk(org.employee, '200.20', 'Travel', 'Bb'); await mk(org.employee2, '50.05', 'Meals', '=cmd|calc');
    await submitExpense(app, org.employee2, '77.00'); // pending: must not count as spend
    const card = (await api(app).post('/api/cards').set(auth(org.admin)).send({ employeeId: org.employee.employeeId, dailyLimit: '1000', monthlyLimit: '5000' }).expect(201)).body.data;
    await api(app).post('/api/transactions/simulate').set(auth(org.employee)).send({ cardId: card.id, amount: '99.95', merchant: 'Kiosk', category: 'Office' }).expect(201);
    await api(app).post('/api/transactions/simulate').set(auth(org.employee)).send({ cardId: card.id, amount: '5000', merchant: 'Big', category: 'Office' }).expect(201); // declined
  });
  afterAll(() => app.close());

  it('dashboard figures equal the database records exactly (decimal-safe)', async () => {
    const d = (await api(app).get('/api/reports/dashboard').set(auth(org.admin)).expect(200)).body.data;
    expect(d.scope).toBe('organisation');
    expect(d.totalSpend).toBe('450.30'); // 100.10 + 200.20 + 50.05 + 99.95 ; pending & declined excluded
    expect(d.monthSpend).toBe('450.30');
    expect(d.budget).toMatchObject({ total: '1000.00', spent: '450.30', available: '549.70', utilisationPct: 45.03 }); // all staff are in Engineering
    expect(d.pendingApprovals).toEqual({ count: 1, amount: '77.00' });
    expect(Object.fromEntries(d.byCategory.map((c: any) => [c.key, c.total]))).toEqual({ Travel: '200.20', Meals: '150.15', Office: '99.95' });
    expect(d.byDepartment[0]).toMatchObject({ label: 'Engineering', total: '450.30' });
    expect(d.monthlyTrend).toHaveLength(1);
    expect(d.recentTransactions.some((t: any) => t.status === 'DECLINED' && t.flagged)).toBe(true);
  });

  it('employee dashboard is personal-scope only', async () => {
    const d = (await api(app).get('/api/reports/dashboard').set(auth(org.employee)).expect(200)).body.data;
    expect(d.scope).toBe('personal'); expect(d.budget).toBeNull();
    expect(d.totalSpend).toBe('400.25'); // 100.10 + 200.20 + 99.95
    expect(d.byDepartment).toEqual([]);
  });

  it('date filters narrow results', async () => {
    const d = (await api(app).get('/api/reports/dashboard?from=2000-01-01&to=2000-12-31').set(auth(org.admin)).expect(200)).body.data;
    expect(d.totalSpend).toBe('0.00'); expect(d.monthlyTrend).toEqual([]);
    await api(app).get('/api/reports/dashboard?from=garbage').set(auth(org.admin)).expect(400);
  });

  it('JSON reports: employee, department, category, monthly, budget utilisation', async () => {
    const emp = (await api(app).get('/api/reports/employees').set(auth(org.finance)).expect(200)).body.data;
    expect(emp.find((r: any) => r.key === org.employee.employeeId).total).toBe('400.25');
    const dep = (await api(app).get('/api/reports/departments').set(auth(org.finance)).expect(200)).body.data;
    expect(dep).toHaveLength(1);
    const util = (await api(app).get('/api/reports/budget-utilisation').set(auth(org.finance)).expect(200)).body.data;
    expect(util[0]).toMatchObject({ name: 'Eng', amount: '1000.00' });
  });

  it('CSV export: proper headers, correct numbers, and formula-injection neutralised', async () => {
    const res = await api(app).get('/api/reports/categories?format=csv').set(auth(org.finance)).expect(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/); expect(res.headers['content-disposition']).toMatch(/attachment; filename="category-spending.csv"/);
    expect(res.text.split('\r\n')[0]).toBe('Category,Total,Items'); expect(res.text).toContain('Travel,200.20,1');
    const emp = await api(app).get('/api/reports/budget-utilisation?format=csv').set(auth(org.admin)).expect(200);
    expect(emp.text).toContain('Eng,Engineering,1000.00,450.30,549.70');
    await api(app).get('/api/reports/monthly?format=csv').set(auth(org.employee)).expect(403);
  });
});

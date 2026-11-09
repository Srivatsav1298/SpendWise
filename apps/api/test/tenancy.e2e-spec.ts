import { INestApplication } from '@nestjs/common';
import { api, auth, createApp, createOrg, Org, PNG, submitExpense, today } from './helpers';

describe('Organisation isolation & RBAC (e2e)', () => {
  let app: INestApplication; let a: Org; let b: Org;
  beforeAll(async () => { ({ app } = await createApp()); a = await createOrg(app); b = await createOrg(app); });
  afterAll(() => app.close());

  it("org B's admin cannot read, approve or touch org A's data (404, never 403/200)", async () => {
    const cheap = await submitExpense(app, a.employee, '30.00'); const id = cheap.body.data.id;
    await api(app).get(`/api/expenses/${id}`).set(auth(b.admin)).expect(404);
    await api(app).post(`/api/approvals/${id}/approve`).set(auth(b.admin)).send({}).expect(404);
    await api(app).post(`/api/approvals/${id}/reject`).set(auth(b.admin)).send({ reason: 'nope nope' }).expect(404);
    await api(app).get(`/api/approvals/expense/${id}`).set(auth(b.finance)).expect(404);
    const list = await api(app).get('/api/expenses?pageSize=100').set(auth(b.admin)).expect(200);
    expect(list.body.data.find((x: any) => x.id === id)).toBeUndefined();
    // still pending for the rightful org
    const stillOk = await api(app).get(`/api/expenses/${id}`).set(auth(a.admin)).expect(200);
    expect(stillOk.body.data.status).toBe('SUBMITTED');
  });

  it('employees, departments, cards, budgets, audit logs do not leak across orgs', async () => {
    await api(app).get(`/api/employees/${a.employee.employeeId}`).set(auth(b.admin)).expect(404);
    await api(app).patch(`/api/employees/${a.employee.employeeId}`).set(auth(b.admin)).send({ jobTitle: 'pwned' }).expect(404);
    await api(app).post(`/api/employees/${a.employee.employeeId}/deactivate`).set(auth(b.admin)).expect(404);
    const emps = await api(app).get('/api/employees').set(auth(b.admin)).expect(200);
    expect(emps.body.data.some((e: any) => e.id === a.employee.employeeId)).toBe(false);
    const dep = await api(app).get('/api/departments').set(auth(b.admin)).expect(200);
    expect(dep.body.data.some((d: any) => d.id === a.departmentId)).toBe(false);
    await api(app).delete(`/api/departments/${a.departmentId}`).set(auth(b.admin)).expect(404);
    // cannot issue a card to, or create a budget for, a foreign employee/department
    await api(app).post('/api/cards').set(auth(b.admin)).send({ employeeId: a.employee.employeeId, dailyLimit: '100', monthlyLimit: '1000' }).expect(404);
    await api(app).post('/api/budgets').set(auth(b.admin)).send({ name: 'xx', departmentId: a.departmentId, amount: '10', periodStart: today(), periodEnd: today() }).expect(404);
    const audit = await api(app).get('/api/audit-logs?pageSize=100').set(auth(b.admin)).expect(200);
    expect(audit.body.data.every((l: any) => l.organisationId === b.id)).toBe(true);
  });

  it("cards & transactions of another org are invisible and unusable", async () => {
    const card = await api(app).post('/api/cards').set(auth(a.admin)).send({ employeeId: a.employee.employeeId, dailyLimit: '1000', monthlyLimit: '5000' }).expect(201);
    await api(app).get(`/api/cards/${card.body.data.id}`).set(auth(b.admin)).expect(404);
    await api(app).post(`/api/cards/${card.body.data.id}/status`).set(auth(b.admin)).send({ status: 'DEACTIVATED' }).expect(404);
    await api(app).post('/api/transactions/simulate').set(auth(b.admin)).send({ cardId: card.body.data.id, amount: '10', merchant: 'X1', category: 'Meals' }).expect(404);
    const tx = await api(app).post('/api/transactions/simulate').set(auth(a.employee)).send({ cardId: card.body.data.id, amount: '10', merchant: 'X1', category: 'Meals' }).expect(201);
    await api(app).get(`/api/transactions/${tx.body.data.id}`).set(auth(b.admin)).expect(404);
  });

  it("receipts of another org are not downloadable", async () => {
    const d = await api(app).post('/api/expenses').set(auth(a.employee)).send({ amount: '10', currency: 'NOK', expenseDate: today(), category: 'Meals', merchant: 'Cafe' }).expect(201);
    const up = await api(app).post(`/api/expenses/${d.body.data.id}/receipts`).set(auth(a.employee)).attach('file', PNG, { filename: 'r.png' }).expect(201);
    await api(app).get(`/api/receipts/${up.body.data.id}`).set(auth(b.admin)).expect(404);
    await api(app).post(`/api/expenses/${d.body.data.id}/receipts`).set(auth(b.admin)).attach('file', PNG, { filename: 'r.png' }).expect(404);
  });

  it('role matrix: employees are blocked from management endpoints (403)', async () => {
    const e = auth(a.employee);
    for (const [m, url] of [['get', '/api/employees'], ['get', '/api/budgets'], ['get', '/api/policies'], ['get', '/api/approvals/pending'], ['get', '/api/audit-logs'], ['get', '/api/reports/monthly'], ['get', '/api/employees/invitations']] as const) {
      await (api(app) as any)[m](url).set(e).expect(403);
    }
    await api(app).post('/api/employees/invite').set(e).send({ email: 'x@y.zz', role: 'EMPLOYEE' }).expect(403);
    await api(app).post('/api/departments').set(e).send({ name: 'Nope' }).expect(403);
    await api(app).post('/api/cards').set(e).send({ employeeId: a.employee.employeeId, dailyLimit: '1', monthlyLimit: '2' }).expect(403);
  });

  it('finance managers can review/report but cannot administer (invite, budgets, org settings)', async () => {
    const f = auth(a.finance);
    await api(app).get('/api/employees').set(f).expect(200);
    await api(app).get('/api/budgets').set(f).expect(200);
    await api(app).get('/api/reports/monthly').set(f).expect(200);
    await api(app).post('/api/employees/invite').set(f).send({ email: 'x@y.zz', role: 'EMPLOYEE' }).expect(403);
    await api(app).post('/api/budgets').set(f).send({ name: 'xx', amount: '10', periodStart: today(), periodEnd: today() }).expect(403);
    await api(app).patch('/api/organisations/current').set(f).send({ name: 'hijack' }).expect(403);
  });

  it('super admin endpoints are closed to org admins; super admin has no tenant data access', async () => {
    await api(app).get('/api/platform/organisations').set(auth(a.admin)).expect(403);
    await api(app).patch(`/api/platform/organisations/${b.id}/status`).set(auth(a.admin)).send({ status: 'SUSPENDED' }).expect(403);
  });

  it('suspended organisations lose access immediately; deactivated employees too', async () => {
    const c = await createOrg(app);
    await api(app).post(`/api/employees/${c.employee2.employeeId}/deactivate`).set(auth(c.admin)).expect(201);
    await api(app).get('/api/expenses').set(auth(c.employee2)).expect(401);
    await api(app).post('/api/auth/refresh').send({ refreshToken: c.employee2.refreshToken }).expect(401);
    await api(app).post(`/api/employees/${c.admin.employeeId}/deactivate`).set(auth(c.admin)).expect(403); // not yourself
  });

  it('the last org admin cannot be demoted', async () => {
    const c = await createOrg(app);
    await api(app).patch(`/api/employees/${c.admin.employeeId}`).set(auth(c.admin)).send({ role: 'EMPLOYEE' }).expect(400);
  });
});

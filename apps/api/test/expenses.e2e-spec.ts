import { INestApplication } from '@nestjs/common';
import { api, auth, createApp, createOrg, Org, PNG, submitExpense, today } from './helpers';

describe('Expenses, receipts & approvals (e2e)', () => {
  let app: INestApplication; let org: Org;
  beforeAll(async () => { ({ app } = await createApp()); org = await createOrg(app); });
  afterAll(() => app.close());

  it('validates required fields and amount format', async () => {
    const e = org.employee;
    await api(app).post('/api/expenses').set(auth(e)).send({}).expect(400);
    await api(app).post('/api/expenses').set(auth(e)).send({ amount: '-5', currency: 'NOK', expenseDate: today(), category: 'Meals', merchant: 'X' }).expect(400);
    await api(app).post('/api/expenses').set(auth(e)).send({ amount: '10.999', currency: 'NOK', expenseDate: today(), category: 'Meals', merchant: 'X' }).expect(400);
    await api(app).post('/api/expenses').set(auth(e)).send({ amount: '10', currency: 'EUR', expenseDate: today(), category: 'Meals', merchant: 'X' }).expect(400); // non-base currency
  });

  it('employee creates draft → submits; status and money are exact strings', async () => {
    const e = org.employee;
    const d = await api(app).post('/api/expenses').set(auth(e)).send({ amount: '123.45', currency: 'NOK', expenseDate: today(), category: 'Meals', merchant: 'Cafe' }).expect(201);
    expect(d.body.data.status).toBe('DRAFT'); expect(d.body.data.amount).toBe('123.45');
    const s = await api(app).post(`/api/expenses/${d.body.data.id}/submit`).set(auth(e)).expect(201);
    expect(s.body.data.status).toBe('SUBMITTED');
    await api(app).patch(`/api/expenses/${d.body.data.id}`).set(auth(e)).send({ amount: '1.00' }).expect(409); // locked after submit
    await api(app).delete(`/api/expenses/${d.body.data.id}`).set(auth(e)).expect(409);
  });

  it('requires a receipt over the threshold; accepts real images, rejects disguised files', async () => {
    const e = org.employee;
    const d = await api(app).post('/api/expenses').set(auth(e)).send({ amount: '900.00', currency: 'NOK', expenseDate: today(), category: 'Equipment', merchant: 'Elkjop' }).expect(201);
    const id = d.body.data.id;
    await api(app).post(`/api/expenses/${id}/submit`).set(auth(e)).expect(422);
    await api(app).post(`/api/expenses/${id}/receipts`).set(auth(e)).attach('file', Buffer.from('<script>alert(1)</script>'), { filename: 'evil.png', contentType: 'image/png' }).expect(400);
    await api(app).post(`/api/expenses/${id}/receipts`).set(auth(e)).expect(400);
    const up = await api(app).post(`/api/expenses/${id}/receipts`).set(auth(e)).attach('file', PNG, { filename: 'r.png', contentType: 'image/png' }).expect(201);
    await api(app).post(`/api/expenses/${id}/submit`).set(auth(e)).expect(201);

    // Retrieval: owner + managers yes; other employee no (404); anonymous no.
    const dl = await api(app).get(`/api/receipts/${up.body.data.id}`).set(auth(e)).expect(200);
    expect(dl.headers['content-type']).toBe('image/png'); expect(dl.headers['x-content-type-options']).toBe('nosniff');
    await api(app).get(`/api/receipts/${up.body.data.id}`).set(auth(org.finance)).expect(200);
    await api(app).get(`/api/receipts/${up.body.data.id}`).set(auth(org.employee2)).expect(404);
    await api(app).get(`/api/receipts/${up.body.data.id}`).expect(401);
  });

  it('enforces the employee monthly limit on submission (backend)', async () => {
    // employee limit is 10000.00; use a fresh employee month to avoid interference: submit near the cap
    const e = org.employee;
    const big = await api(app).post('/api/expenses').set(auth(e)).send({ amount: '9800.00', currency: 'NOK', expenseDate: today(), category: 'Software', merchant: 'AWS' }).expect(201);
    await api(app).post(`/api/expenses/${big.body.data.id}/receipts`).set(auth(e)).attach('file', PNG, { filename: 'r.png' }).expect(201);
    const over = await api(app).post(`/api/expenses/${big.body.data.id}/submit`).set(auth(e));
    expect(over.status).toBe(422); expect(over.body.message).toMatch(/monthly spending limit/);
  });

  it('employees only see their own expenses; managers see all; filters work', async () => {
    const mine = await api(app).get('/api/expenses').set(auth(org.employee)).expect(200);
    expect(mine.body.data.length).toBeGreaterThan(0);
    expect(mine.body.data.every((x: any) => x.employee.id === org.employee.employeeId)).toBe(true);
    // employeeId filter must NOT let an employee peek at colleagues
    const peek = await api(app).get(`/api/expenses?employeeId=${org.employee2.employeeId}`).set(auth(org.employee)).expect(200);
    expect(peek.body.data.every((x: any) => x.employee.id === org.employee.employeeId)).toBe(true);
    await submitExpense(app, org.employee2, '55.00').then((r) => expect(r.status).toBe(201));
    const all = await api(app).get('/api/expenses?pageSize=100').set(auth(org.finance)).expect(200);
    expect(new Set(all.body.data.map((x: any) => x.employee.id)).size).toBeGreaterThanOrEqual(2);
    const f = await api(app).get('/api/expenses?status=SUBMITTED&category=meals').set(auth(org.finance)).expect(200);
    expect(f.body.data.every((x: any) => x.status === 'SUBMITTED' && x.category === 'Meals')).toBe(true);
    expect(f.body.meta).toMatchObject({ page: 1 });
  });

  describe('approvals', () => {
    it('employees cannot approve; approvers cannot approve their own expense', async () => {
      const sub = await submitExpense(app, org.employee, '200.00'); const id = sub.body.data.id;
      await api(app).post(`/api/approvals/${id}/approve`).set(auth(org.employee)).send({}).expect(403);
      await api(app).post(`/api/approvals/${id}/approve`).set(auth(org.employee2)).send({}).expect(403);
      const own = await submitExpense(app, org.finance, '150.00'); expect(own.status).toBe(201);
      await api(app).post(`/api/approvals/${own.body.data.id}/approve`).set(auth(org.finance)).send({}).expect(403);
      await api(app).post(`/api/approvals/${own.body.data.id}/reject`).set(auth(org.finance)).send({ reason: 'self' }).expect(403);
      // ...but another approver can
      await api(app).post(`/api/approvals/${own.body.data.id}/approve`).set(auth(org.admin)).send({}).expect(201);
      const pending = await api(app).get('/api/approvals/pending').set(auth(org.finance)).expect(200);
      expect(pending.body.data.some((x: any) => x.id === own.body.data.id)).toBe(false);
    });

    it('rejection requires a reason; history + notifications recorded; resubmit works', async () => {
      const sub = await submitExpense(app, org.employee, '60.00'); const id = sub.body.data.id;
      await api(app).post(`/api/approvals/${id}/reject`).set(auth(org.finance)).send({}).expect(400);
      await api(app).post(`/api/approvals/${id}/reject`).set(auth(org.finance)).send({ reason: 'ab' }).expect(400);
      const rej = await api(app).post(`/api/approvals/${id}/reject`).set(auth(org.finance)).send({ reason: 'Missing project code' }).expect(201);
      expect(rej.body.data.status).toBe('REJECTED');
      await api(app).post(`/api/approvals/${id}/approve`).set(auth(org.finance)).send({}).expect(409); // no longer SUBMITTED
      const hist = await api(app).get(`/api/approvals/expense/${id}`).set(auth(org.employee)).expect(200);
      expect(hist.body.data[0]).toMatchObject({ decision: 'REJECTED', comment: 'Missing project code', approverId: org.finance.userId });
      expect(hist.body.data[0].createdAt).toBeDefined();
      const notes = await api(app).get('/api/notifications').set(auth(org.employee)).expect(200);
      expect(notes.body.data.some((n: any) => /rejected/i.test(n.title))).toBe(true);
      await api(app).post(`/api/expenses/${id}/submit`).set(auth(org.employee)).expect(201); // fix & resubmit
    });

    it('approve → reimburse lifecycle; invalid transitions are 409', async () => {
      const sub = await submitExpense(app, org.employee2, '75.00'); const id = sub.body.data.id;
      await api(app).post(`/api/approvals/${id}/reimburse`).set(auth(org.finance)).send({}).expect(409); // not approved yet
      const ap = await api(app).post(`/api/approvals/${id}/approve`).set(auth(org.finance)).send({ comment: 'ok' }).expect(201);
      expect(ap.body.data.status).toBe('APPROVED');
      await api(app).post(`/api/approvals/${id}/approve`).set(auth(org.finance)).send({}).expect(409); // double approve
      const re = await api(app).post(`/api/approvals/${id}/reimburse`).set(auth(org.admin)).send({}).expect(201);
      expect(re.body.data.status).toBe('REIMBURSED');
      expect(re.body.data.approvals.map((a: any) => a.decision)).toEqual(['APPROVED', 'REIMBURSED']);
    });

    it('two concurrent approvals of one expense: exactly one wins', async () => {
      const sub = await submitExpense(app, org.employee2, '20.00'); const id = sub.body.data.id;
      const rs = await Promise.all([org.finance, org.admin].map((a) => api(app).post(`/api/approvals/${id}/approve`).set(auth(a)).send({})));
      expect(rs.map((r) => r.status).sort()).toEqual([201, 409]);
    });
  });
});

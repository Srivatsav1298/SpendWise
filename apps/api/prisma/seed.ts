/* Demo data. Passwords below are DEMO ONLY. Idempotent: wipes and recreates the demo organisation. */
import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();
export const DEMO_PASSWORD = 'Spendwise123!';

let seed = 42;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const money = (min: number, max: number) => (Math.round((min + rnd() * (max - min)) * 100) / 100).toFixed(2);
const daysAgo = (n: number) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); d.setUTCHours(10, 0, 0, 0); return d; };

const CATS: Record<string, string[]> = {
  Travel: ['SAS Airlines', 'Vy Tog', 'Flytoget', 'Scandic Hotels', 'Uber'],
  Meals: ['Maaemo', 'Pascal Konditori', 'Kaffebrenneriet', 'Fuglen', 'Oslo Burger'],
  Software: ['GitHub', 'Figma', 'Notion', 'AWS', 'Slack'],
  Equipment: ['Elkjøp', 'Power', 'Apple Store', 'Komplett'],
  Marketing: ['Meta Ads', 'Google Ads', 'Canva', 'Mailchimp'],
  Office: ['IKEA', 'Clas Ohlson', 'Kontorrekvisita'],
};

async function main() {
  const existing = await prisma.organisation.findUnique({ where: { slug: 'fjord-technologies' } });
  if (existing) {
    const members = await prisma.organisationMembership.findMany({ where: { organisationId: existing.id }, select: { userId: true } });
    await prisma.$transaction([
      prisma.transaction.deleteMany({ where: { organisationId: existing.id } }),
      prisma.corporateCard.deleteMany({ where: { organisationId: existing.id } }),
      prisma.organisation.delete({ where: { id: existing.id } }),
      prisma.user.deleteMany({ where: { id: { in: members.map((m) => m.userId) }, isSuperAdmin: false } }),
    ]);
  }
  const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });

  const sa = await prisma.user.upsert({ where: { email: 'superadmin@spendwise.demo' }, update: { passwordHash }, create: { email: 'superadmin@spendwise.demo', passwordHash, firstName: 'Sigrid', lastName: 'Platform', isSuperAdmin: true } });

  const org = await prisma.organisation.create({ data: { name: 'Fjord Technologies AS', slug: 'fjord-technologies', baseCurrency: 'NOK', requireReceiptOver: '500.00' } });
  const [eng, sales, ops] = await Promise.all(['Engineering', 'Sales', 'Operations'].map((name) => prisma.department.create({ data: { organisationId: org.id, name } })));

  const people: { email: string; first: string; last: string; role: Role; dept?: string; title: string; limit?: string }[] = [
    { email: 'admin@spendwise.demo', first: 'Astrid', last: 'Hansen', role: 'ORG_ADMIN', dept: ops.id, title: 'COO' },
    { email: 'finance@spendwise.demo', first: 'Magnus', last: 'Olsen', role: 'FINANCE_MANAGER', dept: ops.id, title: 'Finance Manager' },
    { email: 'employee@spendwise.demo', first: 'Ingrid', last: 'Berg', role: 'EMPLOYEE', dept: eng.id, title: 'Software Engineer', limit: '20000.00' },
    { email: 'lars@spendwise.demo', first: 'Lars', last: 'Dahl', role: 'EMPLOYEE', dept: eng.id, title: 'Tech Lead', limit: '30000.00' },
    { email: 'nora@spendwise.demo', first: 'Nora', last: 'Strand', role: 'EMPLOYEE', dept: sales.id, title: 'Account Executive', limit: '25000.00' },
    { email: 'erik@spendwise.demo', first: 'Erik', last: 'Lund', role: 'EMPLOYEE', dept: sales.id, title: 'Sales Rep', limit: '15000.00' },
  ];
  const emps: Record<string, { employeeId: string; userId: string }> = {};
  for (const p of people) {
    const u = await prisma.user.create({ data: { email: p.email, passwordHash, firstName: p.first, lastName: p.last } });
    await prisma.organisationMembership.create({ data: { userId: u.id, organisationId: org.id, role: p.role } });
    const e = await prisma.employee.create({ data: { userId: u.id, organisationId: org.id, departmentId: p.dept, jobTitle: p.title, monthlyLimit: p.limit } });
    emps[p.email] = { employeeId: e.id, userId: u.id };
  }

  // Budgets: current quarter-ish windows so dashboards are populated and one is near threshold.
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  await prisma.budget.createMany({ data: [
    { organisationId: org.id, name: 'Company-wide H2', amount: '600000.00', currency: 'NOK', periodStart, periodEnd },
    { organisationId: org.id, departmentId: eng.id, name: 'Engineering', amount: '150000.00', currency: 'NOK', periodStart, periodEnd },
    { organisationId: org.id, departmentId: sales.id, name: 'Sales', amount: '90000.00', currency: 'NOK', periodStart, periodEnd },
    { organisationId: org.id, departmentId: ops.id, name: 'Operations', amount: '60000.00', currency: 'NOK', periodStart, periodEnd },
  ] });
  await prisma.spendingPolicy.createMany({ data: [
    { organisationId: org.id, name: 'Meals cap', category: 'Meals', maxAmountPerExpense: '1500.00', requireReceipt: true },
    { organisationId: org.id, name: 'Equipment needs receipt', category: 'Equipment', requireReceipt: true },
  ] });

  // Historical expenses (approved/reimbursed) across ~5 months, plus a few pending/draft/rejected.
  const workers = ['employee@spendwise.demo', 'lars@spendwise.demo', 'nora@spendwise.demo', 'erik@spendwise.demo'];
  for (let i = 0; i < 70; i++) {
    const who = emps[pick(workers)];
    const cat = pick(Object.keys(CATS));
    const age = 10 + Math.floor(rnd() * 150);
    const status = rnd() < 0.55 ? 'REIMBURSED' : 'APPROVED';
    const e = await prisma.expense.create({ data: {
      organisationId: org.id, employeeId: who.employeeId, amount: money(80, cat === 'Equipment' ? 9000 : 2500), currency: 'NOK', expenseDate: daysAgo(age), category: cat, merchant: pick(CATS[cat]),
      description: `${cat} expense`, status, submittedAt: daysAgo(age - 1),
    } });
    await prisma.approval.create({ data: { organisationId: org.id, expenseId: e.id, approverId: emps['finance@spendwise.demo'].userId, decision: 'APPROVED', comment: 'Looks good', createdAt: daysAgo(age - 2) } });
  }
  const mk = (who: string, amount: string, cat: string, merchant: string, status: 'DRAFT' | 'SUBMITTED' | 'REJECTED', age: number) =>
    prisma.expense.create({ data: { organisationId: org.id, employeeId: emps[who].employeeId, amount, currency: 'NOK', expenseDate: daysAgo(age), category: cat, merchant, status, submittedAt: status === 'DRAFT' ? null : daysAgo(age) } });
  await mk('employee@spendwise.demo', '1249.00', 'Travel', 'SAS Airlines', 'SUBMITTED', 2);
  await mk('employee@spendwise.demo', '389.50', 'Meals', 'Fuglen', 'DRAFT', 1);
  await mk('lars@spendwise.demo', '5490.00', 'Equipment', 'Apple Store', 'SUBMITTED', 3);
  await mk('nora@spendwise.demo', '860.00', 'Marketing', 'Meta Ads', 'SUBMITTED', 1);
  const rej = await mk('erik@spendwise.demo', '2300.00', 'Meals', 'Maaemo', 'REJECTED', 6);
  await prisma.approval.create({ data: { organisationId: org.id, expenseId: rej.id, approverId: emps['finance@spendwise.demo'].userId, decision: 'REJECTED', comment: 'Exceeds the meals policy cap' } });

  // Simulated cards + transactions.
  for (const who of workers) {
    const card = await prisma.corporateCard.create({ data: { organisationId: org.id, employeeId: emps[who].employeeId, label: 'SIMULATED Virtual Card', last4: String(1000 + Math.floor(rnd() * 8999)), currency: 'NOK', dailyLimit: '5000.00', monthlyLimit: '15000.00', blockedCategories: ['Gambling', 'Alcohol'] } });
    for (let i = 0; i < 12; i++) {
      const cat = pick(['Software', 'Travel', 'Meals', 'Office']);
      const amt = money(40, 1800);
      await prisma.transaction.create({ data: { organisationId: org.id, cardId: card.id, employeeId: emps[who].employeeId, amount: amt, currency: 'NOK', merchant: pick(CATS[cat]), category: cat, status: 'APPROVED', occurredAt: daysAgo(Math.floor(rnd() * 60)) } });
    }
  }
  const nora = await prisma.corporateCard.findFirstOrThrow({ where: { employeeId: emps['nora@spendwise.demo'].employeeId } });
  await prisma.transaction.create({ data: { organisationId: org.id, cardId: nora.id, employeeId: nora.employeeId, amount: '999.00', currency: 'NOK', merchant: 'Casino Oslo', category: 'Gambling', status: 'DECLINED', declineReason: 'Category "Gambling" is restricted for this card', flagged: true, flagReason: 'Category "Gambling" is restricted for this card' } });

  await prisma.notification.createMany({ data: [
    { organisationId: org.id, userId: emps['employee@spendwise.demo'].userId, title: 'Welcome to SpendWise', body: 'Submit your first expense from the Expenses tab.' },
    { organisationId: org.id, userId: emps['finance@spendwise.demo'].userId, title: 'Expense awaiting approval', body: 'Apple Store: 5490.00 NOK' },
  ] });
  await prisma.auditLog.create({ data: { organisationId: org.id, actorId: sa.id, action: 'SEED', entityType: 'Organisation', entityId: org.id } });
  console.log('Seeded. Demo password for all accounts:', DEMO_PASSWORD);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

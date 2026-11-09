import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup-app';
import { PrismaService } from '../src/prisma/prisma.service';

export const PASSWORD = 'Str0ngPassw0rd!';
let n = 0;
export const uniq = (p = 'u') => `${p}${Date.now().toString(36)}${(n++).toString(36)}`;

export async function createApp() {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = mod.createNestApplication();
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

export interface Actor { token: string; refreshToken: string; userId: string; employeeId: string; email: string }
export interface Org { id: string; admin: Actor; finance: Actor; employee: Actor; employee2: Actor; departmentId: string }

const http = (app: INestApplication) => request(app.getHttpServer());
export const api = http;

export async function register(app: INestApplication, orgName = uniq('Org')) {
  const email = `${uniq('admin')}@test.dev`;
  const res = await http(app).post('/api/auth/register').send({ email, password: PASSWORD, firstName: 'Ada', lastName: 'Admin', organisationName: orgName, baseCurrency: 'NOK' }).expect(201);
  return { email, ...res.body.data };
}

/** Full org: admin + finance manager + two employees (one in a department), created through the real API (invite -> accept). */
export async function createOrg(app: INestApplication): Promise<Org> {
  const reg = await register(app);
  const adminToken = reg.accessToken as string;
  const me = await http(app).get('/api/auth/me').set('Authorization', `Bearer ${adminToken}`).expect(200);
  const dept = await http(app).post('/api/departments').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Engineering' }).expect(201);

  const mkActor = async (role: string, monthlyLimit?: string): Promise<Actor> => {
    const email = `${uniq(role.toLowerCase())}@test.dev`;
    const inv = await http(app).post('/api/employees/invite').set('Authorization', `Bearer ${adminToken}`).send({ email, role, departmentId: dept.body.data.id, ...(monthlyLimit ? { monthlyLimit } : {}) }).expect(201);
    const acc = await http(app).post('/api/auth/accept-invite').send({ token: inv.body.data.inviteToken, password: PASSWORD, firstName: role, lastName: 'Test' }).expect(201);
    const m = await http(app).get('/api/auth/me').set('Authorization', `Bearer ${acc.body.data.accessToken}`).expect(200);
    return { token: acc.body.data.accessToken, refreshToken: acc.body.data.refreshToken, userId: m.body.data.id, employeeId: m.body.data.employeeId, email };
  };
  return {
    id: me.body.data.organisation.id, departmentId: dept.body.data.id,
    admin: { token: adminToken, refreshToken: reg.refreshToken, userId: me.body.data.id, employeeId: me.body.data.employeeId, email: reg.email },
    finance: await mkActor('FINANCE_MANAGER'),
    employee: await mkActor('EMPLOYEE', '10000.00'),
    employee2: await mkActor('EMPLOYEE'),
  };
}

export const auth = (a: Actor) => ({ Authorization: `Bearer ${a.token}` });
export const today = () => new Date().toISOString().slice(0, 10);

export async function submitExpense(app: INestApplication, a: Actor, amount = '100.00', extra: Record<string, unknown> = {}) {
  const res = await http(app).post('/api/expenses').set(auth(a)).send({ amount, currency: 'NOK', expenseDate: today(), category: 'Travel', merchant: 'Vy', submit: true, ...extra });
  return res;
}

// 1x1 transparent PNG
export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

import { INestApplication } from '@nestjs/common';
import { api, createApp, PASSWORD, register, uniq } from './helpers';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => { ({ app } = await createApp()); });
  afterAll(() => app.close());

  it('registers an organisation + admin and returns tokens', async () => {
    const res = await api(app).post('/api/auth/register').send({ email: `${uniq()}@t.dev`, password: PASSWORD, firstName: 'A', lastName: 'B', organisationName: 'Acme' }).expect(201);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.role).toBe('ORG_ADMIN');
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
  });

  it('rejects weak passwords, bad emails and unknown fields (validation)', async () => {
    const base = { email: `${uniq()}@t.dev`, password: PASSWORD, firstName: 'A', lastName: 'B', organisationName: 'Acme' };
    await api(app).post('/api/auth/register').send({ ...base, password: 'short1' }).expect(400);
    await api(app).post('/api/auth/register').send({ ...base, email: 'nope' }).expect(400);
    await api(app).post('/api/auth/register').send({ ...base, isSuperAdmin: true }).expect(400); // mass-assignment guard
  });

  it('rejects duplicate email with 409 (case-insensitive)', async () => {
    const r = await register(app);
    await api(app).post('/api/auth/register').send({ email: r.email.toUpperCase(), password: PASSWORD, firstName: 'A', lastName: 'B', organisationName: 'Dup' }).expect(409);
  });

  it('logs in, and uses one generic error for wrong password / unknown user', async () => {
    const r = await register(app);
    await api(app).post('/api/auth/login').send({ email: r.email, password: PASSWORD }).expect(200);
    const wrong = await api(app).post('/api/auth/login').send({ email: r.email, password: 'Wrong-pass-123' }).expect(401);
    const unknown = await api(app).post('/api/auth/login').send({ email: 'ghost@t.dev', password: 'Wrong-pass-123' }).expect(401);
    expect(wrong.body.message).toBe(unknown.body.message);
  });

  it('protects routes: 401 without or with a garbage token', async () => {
    await api(app).get('/api/expenses').expect(401);
    await api(app).get('/api/expenses').set('Authorization', 'Bearer garbage').expect(401);
  });

  it('rotates refresh tokens; replaying an old one revokes the new one too', async () => {
    const r = await register(app);
    const first = r.refreshToken as string;
    const second = await api(app).post('/api/auth/refresh').send({ refreshToken: first }).expect(200);
    expect(second.body.data.refreshToken).not.toBe(first);
    await api(app).post('/api/auth/refresh').send({ refreshToken: first }).expect(401); // reuse detected
    await api(app).post('/api/auth/refresh').send({ refreshToken: second.body.data.refreshToken }).expect(401); // family revoked
  });

  it('logout revokes the refresh token', async () => {
    const r = await register(app);
    await api(app).post('/api/auth/logout').send({ refreshToken: r.refreshToken }).expect(200);
    await api(app).post('/api/auth/refresh').send({ refreshToken: r.refreshToken }).expect(401);
  });

  it('password reset: token is single-use, changes the password and revokes sessions', async () => {
    const r = await register(app);
    const f = await api(app).post('/api/auth/forgot-password').send({ email: r.email }).expect(200);
    const token = f.body.data.resetToken;
    expect(token).toBeDefined();
    await api(app).post('/api/auth/reset-password').send({ token, password: 'Brand-New-Pass1' }).expect(200);
    await api(app).post('/api/auth/reset-password').send({ token, password: 'Another-Pass-22' }).expect(400);
    await api(app).post('/api/auth/login').send({ email: r.email, password: PASSWORD }).expect(401);
    await api(app).post('/api/auth/login').send({ email: r.email, password: 'Brand-New-Pass1' }).expect(200);
    await api(app).post('/api/auth/refresh').send({ refreshToken: r.refreshToken }).expect(401);
  });

  it('forgot-password gives the same shape for unknown emails (no enumeration)', async () => {
    const res = await api(app).post('/api/auth/forgot-password').send({ email: 'nobody@t.dev' }).expect(200);
    expect(res.body.data).toEqual({ ok: true });
  });
});

import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { hashToken } from './tokens';

const make = (prisma: any, env: Record<string, string> = { NODE_ENV: 'test' }) =>
  new AuthService(prisma, { signAsync: async () => 'jwt' } as any, { get: (k: string) => env[k] } as any, { log: async () => undefined } as any);

describe('AuthService', () => {
  it('rejects wrong password and unknown users with the same error', async () => {
    const hash = await argon2.hash('Correct-Horse-9');
    const prisma = { user: { findUnique: jest.fn().mockResolvedValueOnce({ id: 'u', passwordHash: hash, isActive: true }).mockResolvedValueOnce(null) } };
    const svc = make(prisma);
    await expect(svc.login({ email: 'a@b.c', password: 'nope' })).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
    await expect(svc.login({ email: 'x@b.c', password: 'nope' })).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
  });

  it('rejects login for deactivated users even with the right password', async () => {
    const hash = await argon2.hash('Correct-Horse-9');
    const svc = make({ user: { findUnique: async () => ({ id: 'u', passwordHash: hash, isActive: false }) } });
    await expect(svc.login({ email: 'a@b.c', password: 'Correct-Horse-9' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuses duplicate registration', async () => {
    const svc = make({ user: { findUnique: async () => ({ id: 'exists' }) } });
    await expect(svc.register({ email: 'a@b.c', password: 'Correct-Horse-9', firstName: 'a', lastName: 'b', organisationName: 'Org' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('revokes the whole token family when a rotated refresh token is replayed', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 2 });
    const prisma = { refreshToken: { findUnique: async () => ({ id: 'r', userId: 'u', familyId: 'fam', revokedAt: new Date(), expiresAt: new Date(Date.now() + 1e6) }), updateMany } };
    await expect(make(prisma).refresh('replayed')).rejects.toThrow(/reuse/);
    expect(updateMany).toHaveBeenCalledWith({ where: { familyId: 'fam', revokedAt: null }, data: { revokedAt: expect.any(Date) } });
  });

  it('looks refresh tokens up by hash, never by raw value', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    await expect(make({ refreshToken: { findUnique } }).refresh('raw-token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findUnique).toHaveBeenCalledWith({ where: { tokenHash: hashToken('raw-token') } });
  });

  it('does not reveal whether an email exists on forgot-password, and hides the token in production', async () => {
    const create = jest.fn();
    const prisma = { user: { findUnique: async (a: any) => (a.where.email === 'real@x.y' ? { id: 'u', isActive: true } : null) }, passwordReset: { create } };
    const dev = make(prisma);
    expect(Object.keys(await dev.forgotPassword('nobody@x.y'))).toEqual(['ok']);
    expect((await dev.forgotPassword('real@x.y')).resetToken).toBeDefined();
    const prod = make(prisma, { NODE_ENV: 'production' });
    expect(await prod.forgotPassword('real@x.y')).toEqual({ ok: true });
    expect(create).toHaveBeenCalledTimes(2);
  });
});

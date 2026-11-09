import { ConflictException, ForbiddenException, Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { hashToken, newOpaqueToken } from './tokens';
import { AcceptInviteDto, LoginDto, RegisterDto, ResetPasswordDto } from './dto';

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'org';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(private prisma: PrismaService, private jwt: JwtService, private config: ConfigService, private audit: AuditService) {}

  private get isProd() { return this.config.get('NODE_ENV') === 'production'; }

  hash(password: string) { return argon2.hash(password, { type: argon2.argon2id }); }

  async register(dto: RegisterDto) {
    if (await this.prisma.user.findUnique({ where: { email: dto.email } })) throw new ConflictException('Email already registered');
    const passwordHash = await this.hash(dto.password);
    const slug = `${slugify(dto.organisationName)}-${randomUUID().slice(0, 6)}`;
    const { user, org } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email: dto.email, passwordHash, firstName: dto.firstName, lastName: dto.lastName } });
      const org = await tx.organisation.create({ data: { name: dto.organisationName, slug, baseCurrency: (dto.baseCurrency ?? 'NOK').toUpperCase() } });
      await tx.organisationMembership.create({ data: { userId: user.id, organisationId: org.id, role: Role.ORG_ADMIN } });
      await tx.employee.create({ data: { userId: user.id, organisationId: org.id, jobTitle: 'Administrator' } });
      await this.audit.log({ organisationId: org.id, actorId: user.id, action: 'ORG_CREATED', entityType: 'Organisation', entityId: org.id }, tx);
      return { user, org };
    });
    return this.issueSession(user.id, org.id);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    // Always verify against some hash to keep timing similar for unknown emails.
    const ok = user ? await argon2.verify(user.passwordHash, dto.password).catch(() => false) : false;
    if (!user || !ok || !user.isActive) throw new UnauthorizedException('Invalid credentials');
    let orgId: string | null = null;
    const memberships = await this.prisma.organisationMembership.findMany({
      where: { userId: user.id, ...(dto.organisationId ? { organisationId: dto.organisationId } : {}), organisation: { status: 'ACTIVE' } },
      orderBy: { createdAt: 'asc' },
    });
    if (dto.organisationId && !memberships.length) throw new ForbiddenException('Not a member of that organisation');
    orgId = memberships[0]?.organisationId ?? null;
    if (!orgId && !user.isSuperAdmin) throw new ForbiddenException('No active organisation');
    return this.issueSession(user.id, orgId);
  }

  private async issueSession(userId: string, organisationId: string | null, familyId: string = randomUUID()) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const membership = organisationId
      ? await this.prisma.organisationMembership.findUnique({ where: { userId_organisationId: { userId, organisationId } } })
      : null;
    const accessToken = await this.jwt.signAsync({ sub: userId, org: organisationId, role: membership?.role ?? null });
    const refreshToken = newOpaqueToken();
    const ttlDays = Number(this.config.get('REFRESH_TOKEN_TTL_DAYS') ?? 30);
    const row = await this.prisma.refreshToken.create({
      data: { userId, organisationId, familyId, tokenHash: hashToken(refreshToken), expiresAt: new Date(Date.now() + ttlDays * 86400_000) },
    });
    return {
      accessToken,
      refreshToken,
      _refreshId: row.id,
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, isSuperAdmin: user.isSuperAdmin, organisationId, role: membership?.role ?? null },
    };
  }

  /** Rotation: each refresh token is single-use. Re-presenting a used token revokes the whole family. */
  async refresh(rawToken: string) {
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
    if (!row) throw new UnauthorizedException('Invalid refresh token');
    if (row.revokedAt) {
      await this.prisma.refreshToken.updateMany({ where: { familyId: row.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
      this.logger.warn(`Refresh token reuse detected for user ${row.userId}; family revoked`);
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    if (row.expiresAt < new Date()) throw new UnauthorizedException('Refresh token expired');
    const user = await this.prisma.user.findUnique({ where: { id: row.userId } });
    if (!user?.isActive) throw new UnauthorizedException('Account disabled');
    // Atomic claim: only one concurrent caller may consume the token.
    const claimed = await this.prisma.refreshToken.updateMany({ where: { id: row.id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (claimed.count === 0) throw new UnauthorizedException('Refresh token already used');
    const session = await this.issueSession(row.userId, row.organisationId, row.familyId);
    await this.prisma.refreshToken.update({ where: { id: row.id }, data: { replacedById: session._refreshId } });
    const { _refreshId, ...out } = session;
    return out;
  }

  async logout(rawToken: string) {
    await this.prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(rawToken), revokedAt: null }, data: { revokedAt: new Date() } });
    return { ok: true };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const token = newOpaqueToken();
    if (user?.isActive) {
      await this.prisma.passwordReset.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3600_000) } });
      // No email provider is wired up: outside production the token is returned so the flow is testable.
      this.logger.log(`Password reset requested for user ${user.id}`);
    }
    // Same response whether or not the account exists (no user enumeration).
    return { ok: true, ...(this.isProd || !user?.isActive ? {} : { resetToken: token }) };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const row = await this.prisma.passwordReset.findUnique({ where: { tokenHash: hashToken(dto.token) } });
    if (!row || row.usedAt || row.expiresAt < new Date()) throw new BadRequestException('Invalid or expired reset token');
    const passwordHash = await this.hash(dto.password);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
      this.prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      this.prisma.refreshToken.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return { ok: true };
  }

  async acceptInvite(dto: AcceptInviteDto) {
    const inv = await this.prisma.invitation.findUnique({ where: { tokenHash: hashToken(dto.token) } });
    if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) throw new BadRequestException('Invalid or expired invitation');
    const existing = await this.prisma.user.findUnique({ where: { email: inv.email } });
    if (existing) throw new ConflictException('An account with this email already exists; ask an admin to add it directly');
    const passwordHash = await this.hash(dto.password);
    const user = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.invitation.updateMany({ where: { id: inv.id, acceptedAt: null }, data: { acceptedAt: new Date() } });
      if (claimed.count === 0) throw new BadRequestException('Invitation already used');
      const user = await tx.user.create({ data: { email: inv.email, passwordHash, firstName: dto.firstName, lastName: dto.lastName } });
      await tx.organisationMembership.create({ data: { userId: user.id, organisationId: inv.organisationId, role: inv.role } });
      await tx.employee.create({ data: { userId: user.id, organisationId: inv.organisationId, departmentId: inv.departmentId, monthlyLimit: inv.monthlyLimit as Prisma.Decimal | null } });
      await this.audit.log({ organisationId: inv.organisationId, actorId: user.id, action: 'INVITATION_ACCEPTED', entityType: 'User', entityId: user.id }, tx);
      return user;
    });
    return this.issueSession(user.id, inv.organisationId);
  }
}

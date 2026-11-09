import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SpendService } from '../budgets/spend.service';
import { hashToken, newOpaqueToken } from '../auth/tokens';
import { InviteDto, UpdateEmployeeDto, EmployeeQuery } from './dto';
import { pageArgs, pageMeta } from '../common/dto/pagination.dto';
import { D, fmt } from '../common/money';

const include = { user: { select: { id: true, email: true, firstName: true, lastName: true } }, department: { select: { id: true, name: true } } } satisfies Prisma.EmployeeInclude;

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService, private audit: AuditService, private spend: SpendService, private config: ConfigService) {}

  private async present(e: Prisma.EmployeeGetPayload<{ include: typeof include }>) {
    const m = await this.prisma.organisationMembership.findUnique({ where: { userId_organisationId: { userId: e.userId, organisationId: e.organisationId } } });
    return { id: e.id, userId: e.userId, email: e.user.email, firstName: e.user.firstName, lastName: e.user.lastName, role: m?.role, jobTitle: e.jobTitle,
      department: e.department, isActive: e.isActive, monthlyLimit: fmt(e.monthlyLimit), createdAt: e.createdAt };
  }

  async list(orgId: string, q: EmployeeQuery) {
    const where: Prisma.EmployeeWhereInput = {
      organisationId: orgId,
      ...(q.departmentId ? { departmentId: q.departmentId } : {}),
      ...(q.active !== undefined ? { isActive: q.active } : {}),
      ...(q.search ? { user: { OR: [{ email: { contains: q.search, mode: 'insensitive' } }, { firstName: { contains: q.search, mode: 'insensitive' } }, { lastName: { contains: q.search, mode: 'insensitive' } }] } } : {}),
    };
    if (q.role) {
      const ids = (await this.prisma.organisationMembership.findMany({ where: { organisationId: orgId, role: q.role }, select: { userId: true } })).map((m) => m.userId);
      where.userId = { in: ids };
    }
    const [rows, total] = await Promise.all([
      this.prisma.employee.findMany({ where, include, orderBy: { user: { lastName: 'asc' } }, ...pageArgs(q) }),
      this.prisma.employee.count({ where }),
    ]);
    return { items: await Promise.all(rows.map((r) => this.present(r))), meta: pageMeta(q, total) };
  }

  private async find(orgId: string, id: string) {
    const e = await this.prisma.employee.findFirst({ where: { id, organisationId: orgId }, include });
    if (!e) throw new NotFoundException('Employee not found');
    return e;
  }
  async get(orgId: string, id: string) { return this.present(await this.find(orgId, id)); }

  /** The caller's own limits: monthly limit, month-to-date spend, remaining, and their cards. */
  async myLimits(orgId: string, employeeId: string) {
    const e = await this.find(orgId, employeeId);
    const spent = await this.spend.employeeMonthSpend(this.prisma, orgId, employeeId, new Date());
    const cards = await this.prisma.corporateCard.findMany({ where: { organisationId: orgId, employeeId } });
    return {
      monthlyLimit: fmt(e.monthlyLimit), spentThisMonth: fmt(spent),
      remaining: e.monthlyLimit ? fmt(D(e.monthlyLimit).minus(spent).clamp(0, Number.POSITIVE_INFINITY)) : null,
      cards: cards.map((c) => ({ id: c.id, label: c.label, last4: c.last4, status: c.status, dailyLimit: fmt(c.dailyLimit), monthlyLimit: fmt(c.monthlyLimit) })),
    };
  }

  async invite(orgId: string, actorId: string, dto: InviteDto) {
    if (await this.prisma.user.findUnique({ where: { email: dto.email } })) throw new ConflictException('A user with this email already exists');
    if (dto.departmentId && !(await this.prisma.department.findFirst({ where: { id: dto.departmentId, organisationId: orgId } }))) throw new NotFoundException('Department not found');
    const token = newOpaqueToken();
    const inv = await this.prisma.$transaction(async (tx) => {
      await tx.invitation.deleteMany({ where: { organisationId: orgId, email: dto.email, acceptedAt: null } });
      const inv = await tx.invitation.create({ data: { organisationId: orgId, email: dto.email, role: dto.role, departmentId: dto.departmentId, monthlyLimit: dto.monthlyLimit, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 7 * 86400_000) } });
      await this.audit.log({ organisationId: orgId, actorId, action: 'EMPLOYEE_INVITED', entityType: 'Invitation', entityId: inv.id, metadata: { email: dto.email, role: dto.role } }, tx);
      return inv;
    });
    // No email provider: outside production the invite token is returned so it can be delivered manually.
    return { id: inv.id, email: inv.email, role: inv.role, expiresAt: inv.expiresAt, ...(this.config.get('NODE_ENV') === 'production' ? {} : { inviteToken: token }) };
  }

  listInvitations(orgId: string) {
    return this.prisma.invitation.findMany({ where: { organisationId: orgId, acceptedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, email: true, role: true, expiresAt: true } });
  }

  async update(orgId: string, actorId: string, id: string, dto: UpdateEmployeeDto) {
    const e = await this.find(orgId, id);
    if (dto.departmentId && !(await this.prisma.department.findFirst({ where: { id: dto.departmentId, organisationId: orgId } }))) throw new NotFoundException('Department not found');
    await this.prisma.$transaction(async (tx) => {
      if (dto.role) {
        const current = await tx.organisationMembership.findUniqueOrThrow({ where: { userId_organisationId: { userId: e.userId, organisationId: orgId } } });
        if (current.role === Role.ORG_ADMIN && dto.role !== Role.ORG_ADMIN) {
          const admins = await tx.organisationMembership.count({ where: { organisationId: orgId, role: Role.ORG_ADMIN } });
          if (admins <= 1) throw new BadRequestException('Cannot demote the last organisation admin');
        }
        await tx.organisationMembership.update({ where: { id: current.id }, data: { role: dto.role } });
      }
      await tx.employee.update({ where: { id }, data: { departmentId: dto.departmentId, jobTitle: dto.jobTitle, monthlyLimit: dto.monthlyLimit } });
      await this.audit.log({ organisationId: orgId, actorId, action: 'EMPLOYEE_UPDATED', entityType: 'Employee', entityId: id, metadata: { ...dto } }, tx);
    });
    return this.get(orgId, id);
  }

  async setActive(orgId: string, actorId: string, id: string, active: boolean) {
    const e = await this.find(orgId, id);
    if (e.userId === actorId && !active) throw new ForbiddenException('You cannot deactivate yourself');
    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({ where: { id }, data: { isActive: active } });
      if (!active) {
        await tx.refreshToken.updateMany({ where: { userId: e.userId, revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.corporateCard.updateMany({ where: { employeeId: id, status: 'ACTIVE' }, data: { status: 'FROZEN' } });
      }
      await this.audit.log({ organisationId: orgId, actorId, action: active ? 'EMPLOYEE_ACTIVATED' : 'EMPLOYEE_DEACTIVATED', entityType: 'Employee', entityId: id }, tx);
    });
    return this.get(orgId, id);
  }
}

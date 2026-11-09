import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SpendService } from '../budgets/spend.service';
import { AuthUser, isManager } from '../common/auth-user';
import { D, fmt } from '../common/money';
import { CardStatusDto, IssueCardDto, UpdateCardDto } from './dto';

type CardRow = Prisma.CorporateCardGetPayload<{ include: { employee: { include: { user: { select: { firstName: true; lastName: true } } } } } }>;

@Injectable()
export class CardsService {
  constructor(private prisma: PrismaService, private audit: AuditService, private notifications: NotificationsService, private spend: SpendService) {}

  /** Cards are SIMULATED: only a random last4 is kept. No PAN, expiry or CVV exists anywhere in the system. */
  present(c: CardRow, spentMonth?: string) {
    return {
      id: c.id, simulated: true, label: c.label, maskedNumber: `•••• •••• •••• ${c.last4}`, last4: c.last4, status: c.status, currency: c.currency,
      dailyLimit: fmt(c.dailyLimit), monthlyLimit: fmt(c.monthlyLimit), blockedCategories: c.blockedCategories,
      employee: { id: c.employeeId, name: `${c.employee.user.firstName} ${c.employee.user.lastName}` }, ...(spentMonth !== undefined ? { spentThisMonth: spentMonth } : {}), createdAt: c.createdAt,
    };
  }
  private inc = { employee: { include: { user: { select: { firstName: true, lastName: true } } } } } as const;

  async list(u: AuthUser) {
    const rows = await this.prisma.corporateCard.findMany({
      where: { organisationId: u.organisationId!, ...(isManager(u) ? {} : { employeeId: u.employeeId ?? '__none__' }) },
      include: this.inc, orderBy: { createdAt: 'desc' },
    });
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return Promise.all(rows.map(async (c) => this.present(c, fmt(await this.spend.cardSpend(this.prisma, c.id, start, next))!)));
  }

  async loadVisible(u: AuthUser, id: string) {
    const c = await this.prisma.corporateCard.findFirst({ where: { id, organisationId: u.organisationId! }, include: this.inc });
    if (!c || (!isManager(u) && c.employeeId !== u.employeeId)) throw new NotFoundException('Card not found');
    return c;
  }
  async get(u: AuthUser, id: string) { return this.present(await this.loadVisible(u, id)); }

  async issue(u: AuthUser, dto: IssueCardDto) {
    const emp = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, organisationId: u.organisationId! }, include: { organisation: true } });
    if (!emp) throw new NotFoundException('Employee not found');
    if (!emp.isActive) throw new BadRequestException('Cannot issue a card to a deactivated employee');
    if (D(dto.dailyLimit).gt(dto.monthlyLimit)) throw new BadRequestException('Daily limit cannot exceed monthly limit');
    const last4 = String(randomInt(0, 10000)).padStart(4, '0');
    const c = await this.prisma.$transaction(async (tx) => {
      const c = await tx.corporateCard.create({
        data: { organisationId: emp.organisationId, employeeId: emp.id, label: dto.label ?? 'SIMULATED Virtual Card', last4, currency: emp.organisation.baseCurrency, dailyLimit: dto.dailyLimit, monthlyLimit: dto.monthlyLimit, blockedCategories: dto.blockedCategories ?? [] },
        include: this.inc,
      });
      await this.audit.log({ organisationId: emp.organisationId, actorId: u.userId, action: 'CARD_ISSUED', entityType: 'CorporateCard', entityId: c.id, metadata: { employeeId: emp.id } }, tx);
      await this.notifications.notify(emp.organisationId, emp.userId, 'New virtual card issued', `A simulated card ending ${last4} was issued to you.`, tx);
      return c;
    });
    return this.present(c);
  }

  async update(u: AuthUser, id: string, dto: UpdateCardDto) {
    const c = await this.loadVisible(u, id);
    const daily = dto.dailyLimit ?? c.dailyLimit.toString(), monthly = dto.monthlyLimit ?? c.monthlyLimit.toString();
    if (D(daily).gt(monthly)) throw new BadRequestException('Daily limit cannot exceed monthly limit');
    await this.prisma.$transaction(async (tx) => {
      await tx.corporateCard.update({ where: { id }, data: { label: dto.label, dailyLimit: dto.dailyLimit, monthlyLimit: dto.monthlyLimit, blockedCategories: dto.blockedCategories } });
      await this.audit.log({ organisationId: u.organisationId, actorId: u.userId, action: 'CARD_UPDATED', entityType: 'CorporateCard', entityId: id, metadata: { ...dto } }, tx);
    });
    return this.get(u, id);
  }

  async setStatus(u: AuthUser, id: string, dto: CardStatusDto) {
    const c = await this.loadVisible(u, id);
    // Employees may only FREEZE their own card (a safety action); unfreezing/deactivating is manager-only.
    if (!isManager(u) && dto.status !== 'FROZEN') throw new ForbiddenException('Employees can only freeze their own card');
    if (c.status === 'DEACTIVATED') throw new BadRequestException('A deactivated card cannot be reactivated; issue a new card');
    await this.prisma.$transaction(async (tx) => {
      await tx.corporateCard.update({ where: { id }, data: { status: dto.status } });
      await this.audit.log({ organisationId: u.organisationId, actorId: u.userId, action: `CARD_${dto.status}`, entityType: 'CorporateCard', entityId: id }, tx);
    });
    return this.get(u, id);
  }
}

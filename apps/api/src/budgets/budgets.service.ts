import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SpendService } from './spend.service';
import { CreateBudgetDto, PolicyDto, UpdateBudgetDto } from './dto';
import { D, fmt } from '../common/money';
import { utilisation } from './budget-rules';

@Injectable()
export class BudgetsService {
  constructor(private prisma: PrismaService, private spend: SpendService, private audit: AuditService) {}

  private async present(orgId: string, b: any) {
    const spent = await this.spend.budgetConsumption(this.prisma, orgId, b);
    return {
      id: b.id, name: b.name, departmentId: b.departmentId, department: b.department?.name ?? null, currency: b.currency,
      amount: fmt(b.amount), spent: fmt(spent), remaining: fmt(D(b.amount).minus(spent)),
      utilisationPct: utilisation(spent, b.amount).toNumber(), periodStart: b.periodStart, periodEnd: b.periodEnd, thresholdsNotified: b.thresholdsNotified,
    };
  }

  async list(orgId: string) {
    const budgets = await this.prisma.budget.findMany({ where: { organisationId: orgId }, include: { department: { select: { name: true } } }, orderBy: { periodStart: 'desc' } });
    return Promise.all(budgets.map((b) => this.present(orgId, b)));
  }

  async get(orgId: string, id: string) {
    const b = await this.prisma.budget.findFirst({ where: { id, organisationId: orgId }, include: { department: { select: { name: true } } } });
    if (!b) throw new NotFoundException('Budget not found');
    return this.present(orgId, b);
  }

  private checkPeriod(s: Date, e: Date) {
    if (e < s) throw new BadRequestException('periodEnd must be on or after periodStart');
  }

  async create(orgId: string, actorId: string, dto: CreateBudgetDto) {
    const org = await this.prisma.organisation.findUniqueOrThrow({ where: { id: orgId } });
    if (dto.departmentId && !(await this.prisma.department.findFirst({ where: { id: dto.departmentId, organisationId: orgId } }))) throw new NotFoundException('Department not found');
    const periodStart = new Date(dto.periodStart), periodEnd = new Date(dto.periodEnd);
    this.checkPeriod(periodStart, periodEnd);
    if (D(dto.amount).lte(0)) throw new BadRequestException('amount must be positive');
    const b = await this.prisma.$transaction(async (tx) => {
      const b = await tx.budget.create({ data: { organisationId: orgId, departmentId: dto.departmentId, name: dto.name, amount: dto.amount, currency: org.baseCurrency, periodStart, periodEnd } });
      await this.audit.log({ organisationId: orgId, actorId, action: 'BUDGET_CREATED', entityType: 'Budget', entityId: b.id, metadata: { amount: dto.amount, departmentId: dto.departmentId ?? null } }, tx);
      return b;
    });
    return this.get(orgId, b.id);
  }

  async update(orgId: string, actorId: string, id: string, dto: UpdateBudgetDto) {
    const existing = await this.prisma.budget.findFirst({ where: { id, organisationId: orgId } });
    if (!existing) throw new NotFoundException('Budget not found');
    const periodStart = dto.periodStart ? new Date(dto.periodStart) : existing.periodStart;
    const periodEnd = dto.periodEnd ? new Date(dto.periodEnd) : existing.periodEnd;
    this.checkPeriod(periodStart, periodEnd);
    await this.prisma.$transaction(async (tx) => {
      await tx.budget.update({
        where: { id },
        // Changing the amount re-arms threshold alerts.
        data: { name: dto.name, amount: dto.amount, periodStart, periodEnd, ...(dto.amount ? { thresholdsNotified: [] } : {}) },
      });
      await this.audit.log({ organisationId: orgId, actorId, action: 'BUDGET_UPDATED', entityType: 'Budget', entityId: id, metadata: { ...dto } }, tx);
    });
    return this.get(orgId, id);
  }

  async remove(orgId: string, actorId: string, id: string) {
    const r = await this.prisma.budget.deleteMany({ where: { id, organisationId: orgId } });
    if (!r.count) throw new NotFoundException('Budget not found');
    await this.audit.log({ organisationId: orgId, actorId, action: 'BUDGET_DELETED', entityType: 'Budget', entityId: id });
    return { ok: true };
  }

  // ---- spending policies ----
  listPolicies(orgId: string) { return this.prisma.spendingPolicy.findMany({ where: { organisationId: orgId }, orderBy: { createdAt: 'desc' } }); }
  async createPolicy(orgId: string, actorId: string, dto: PolicyDto) {
    const p = await this.prisma.spendingPolicy.create({ data: { organisationId: orgId, ...dto } });
    await this.audit.log({ organisationId: orgId, actorId, action: 'POLICY_CREATED', entityType: 'SpendingPolicy', entityId: p.id });
    return p;
  }
  async updatePolicy(orgId: string, actorId: string, id: string, dto: PolicyDto) {
    const r = await this.prisma.spendingPolicy.updateMany({ where: { id, organisationId: orgId }, data: dto });
    if (!r.count) throw new NotFoundException('Policy not found');
    await this.audit.log({ organisationId: orgId, actorId, action: 'POLICY_UPDATED', entityType: 'SpendingPolicy', entityId: id });
    return this.prisma.spendingPolicy.findUnique({ where: { id } });
  }
  async removePolicy(orgId: string, actorId: string, id: string) {
    const r = await this.prisma.spendingPolicy.deleteMany({ where: { id, organisationId: orgId } });
    if (!r.count) throw new NotFoundException('Policy not found');
    await this.audit.log({ organisationId: orgId, actorId, action: 'POLICY_DELETED', entityType: 'SpendingPolicy', entityId: id });
    return { ok: true };
  }
}

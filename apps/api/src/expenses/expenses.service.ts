import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SpendService } from '../budgets/spend.service';
import { AuthUser, isManager } from '../common/auth-user';
import { pageArgs, pageMeta } from '../common/dto/pagination.dto';
import { D, fmt } from '../common/money';
import { CreateExpenseDto, ExpenseQuery, UpdateExpenseDto } from './dto';
import { canEdit, canSubmit, checkEmployeeLimit, requiresReceipt } from './expense-rules';

const include = {
  employee: { include: { user: { select: { firstName: true, lastName: true, email: true } }, department: { select: { name: true } } } },
  receipts: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true } },
  approvals: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.ExpenseInclude;
type ExpenseFull = Prisma.ExpenseGetPayload<{ include: typeof include }>;

export const presentExpense = (e: ExpenseFull) => ({
  id: e.id, amount: fmt(e.amount), currency: e.currency, expenseDate: e.expenseDate, category: e.category, merchant: e.merchant, description: e.description,
  status: e.status, submittedAt: e.submittedAt, createdAt: e.createdAt,
  employee: { id: e.employeeId, userId: e.employee.userId, name: `${e.employee.user.firstName} ${e.employee.user.lastName}`, email: e.employee.user.email, department: e.employee.department?.name ?? null },
  receipts: e.receipts, approvals: e.approvals,
});

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService, private audit: AuditService, private notifications: NotificationsService, private spend: SpendService) {}

  private requireEmployee(u: AuthUser) {
    if (!u.employeeId) throw new ForbiddenException('No employee profile in this organisation');
    return u.employeeId;
  }

  async create(u: AuthUser, dto: CreateExpenseDto) {
    const employeeId = this.requireEmployee(u);
    const org = await this.prisma.organisation.findUniqueOrThrow({ where: { id: u.organisationId! } });
    if (dto.currency !== org.baseCurrency) throw new BadRequestException(`Only the organisation currency (${org.baseCurrency}) is supported; no FX conversion is available`);
    const emp = await this.prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });
    const e = await this.prisma.$transaction(async (tx) => {
      const e = await tx.expense.create({
        data: { organisationId: org.id, employeeId, departmentId: emp.departmentId, amount: dto.amount, currency: dto.currency, expenseDate: new Date(dto.expenseDate), category: dto.category, merchant: dto.merchant, description: dto.description },
      });
      await this.audit.log({ organisationId: org.id, actorId: u.userId, action: 'EXPENSE_CREATED', entityType: 'Expense', entityId: e.id, metadata: { amount: dto.amount } }, tx);
      return e;
    });
    if (dto.submit) return this.submit(u, e.id);
    return this.get(u, e.id);
  }

  async list(u: AuthUser, q: ExpenseQuery) {
    const manager = isManager(u);
    const where: Prisma.ExpenseWhereInput = {
      organisationId: u.organisationId!,
      // Employees are always scoped to themselves; the employeeId filter is only honoured for managers.
      ...(manager ? (q.employeeId ? { employeeId: q.employeeId } : {}) : { employeeId: u.employeeId ?? '__none__' }),
      ...(q.status ? { status: q.status } : {}),
      ...(q.category ? { category: { equals: q.category, mode: 'insensitive' } } : {}),
      ...(q.from || q.to ? { expenseDate: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } } : {}),
      ...(q.search ? { OR: [{ merchant: { contains: q.search, mode: 'insensitive' } }, { description: { contains: q.search, mode: 'insensitive' } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.expense.findMany({ where, include, orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }], ...pageArgs(q) }),
      this.prisma.expense.count({ where }),
    ]);
    return { items: rows.map(presentExpense), meta: pageMeta(q, total) };
  }

  /** Fetches an expense the caller may see: own for employees, any in-org for managers. Otherwise 404 (no existence leak). */
  async load(u: AuthUser, id: string): Promise<ExpenseFull> {
    const e = await this.prisma.expense.findFirst({ where: { id, organisationId: u.organisationId! }, include });
    if (!e || (!isManager(u) && e.employeeId !== u.employeeId)) throw new NotFoundException('Expense not found');
    return e;
  }
  async get(u: AuthUser, id: string) { return presentExpense(await this.load(u, id)); }

  private async loadOwned(u: AuthUser, id: string) {
    const e = await this.load(u, id);
    if (e.employeeId !== u.employeeId) throw new ForbiddenException('Only the expense owner can modify it');
    return e;
  }

  async update(u: AuthUser, id: string, dto: UpdateExpenseDto) {
    const e = await this.loadOwned(u, id);
    if (!canEdit(e.status)) throw new ConflictException(`A ${e.status} expense cannot be edited`);
    await this.prisma.$transaction(async (tx) => {
      await tx.expense.update({ where: { id }, data: { amount: dto.amount, expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : undefined, category: dto.category, merchant: dto.merchant, description: dto.description, status: 'DRAFT' } });
      await this.audit.log({ organisationId: u.organisationId, actorId: u.userId, action: 'EXPENSE_UPDATED', entityType: 'Expense', entityId: id }, tx);
    });
    return this.get(u, id);
  }

  async remove(u: AuthUser, id: string) {
    const e = await this.loadOwned(u, id);
    if (e.status !== 'DRAFT') throw new ConflictException('Only draft expenses can be deleted');
    await this.prisma.expense.delete({ where: { id } });
    await this.audit.log({ organisationId: u.organisationId, actorId: u.userId, action: 'EXPENSE_DELETED', entityType: 'Expense', entityId: id });
    return { ok: true };
  }

  async submit(u: AuthUser, id: string) {
    const owned = await this.loadOwned(u, id);
    await this.prisma.$transaction(async (tx) => {
      // Serialise concurrent submissions by the same employee so the monthly limit can't be raced.
      await tx.$queryRaw`SELECT id FROM "Employee" WHERE id = ${owned.employeeId} FOR UPDATE`;
      const e = await tx.expense.findUniqueOrThrow({ where: { id }, include: { receipts: true, employee: true } });
      if (!canSubmit(e.status)) throw new ConflictException(`A ${e.status} expense cannot be submitted`);
      const org = await tx.organisation.findUniqueOrThrow({ where: { id: e.organisationId } });
      const policies = await tx.spendingPolicy.findMany({ where: { organisationId: e.organisationId, isActive: true, OR: [{ category: null }, { category: { equals: e.category, mode: 'insensitive' } }] } });

      const needsReceipt = requiresReceipt(e.amount, org.requireReceiptOver, policies.some((p) => p.requireReceipt && p.category !== null));
      if (needsReceipt && e.receipts.length === 0) throw new UnprocessableEntityException('A receipt is required for this expense before it can be submitted');
      for (const p of policies) {
        if (p.maxAmountPerExpense && D(e.amount).gt(p.maxAmountPerExpense)) throw new UnprocessableEntityException(`Exceeds policy "${p.name}": maximum ${D(p.maxAmountPerExpense).toFixed(2)} per expense`);
      }
      const spent = await this.spend.employeeMonthSpend(tx, e.organisationId, e.employeeId, e.expenseDate, e.id);
      const lim = checkEmployeeLimit(spent, e.amount, e.employee.monthlyLimit);
      if (!lim.ok) throw new UnprocessableEntityException(`Exceeds your monthly spending limit (remaining ${lim.remaining?.toFixed(2)} ${e.currency})`);

      await tx.expense.update({ where: { id }, data: { status: 'SUBMITTED', submittedAt: new Date() } });
      await this.audit.log({ organisationId: e.organisationId, actorId: u.userId, action: 'EXPENSE_SUBMITTED', entityType: 'Expense', entityId: id, metadata: { amount: e.amount.toFixed(2) } }, tx);
      await this.notifications.notifyRoles(e.organisationId, ['ORG_ADMIN', 'FINANCE_MANAGER'], 'Expense awaiting approval', `${e.merchant}: ${e.amount.toFixed(2)} ${e.currency}`, tx);
    });
    return this.get(u, id);
  }
}

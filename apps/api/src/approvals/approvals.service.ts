import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ApprovalDecision, ExpenseStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BudgetGuardService } from '../budgets/budget-guard.service';
import { AuthUser } from '../common/auth-user';
import { PaginationDto, pageArgs, pageMeta } from '../common/dto/pagination.dto';
import { canDecide, canReimburse, isSelfApproval } from '../expenses/expense-rules';
import { ExpensesService, presentExpense } from '../expenses/expenses.service';

@Injectable()
export class ApprovalsService {
  constructor(private prisma: PrismaService, private audit: AuditService, private notifications: NotificationsService, private guard: BudgetGuardService, private expenses: ExpensesService) {}

  async pending(u: AuthUser, q: PaginationDto) {
    const where: Prisma.ExpenseWhereInput = { organisationId: u.organisationId!, status: 'SUBMITTED', employee: { userId: { not: u.userId } } };
    const [rows, total] = await Promise.all([
      this.prisma.expense.findMany({
        where, orderBy: { submittedAt: 'asc' }, ...pageArgs(q),
        include: { employee: { include: { user: { select: { firstName: true, lastName: true, email: true } }, department: { select: { name: true } } } }, receipts: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true } }, approvals: true },
      }),
      this.prisma.expense.count({ where }),
    ]);
    return { items: rows.map(presentExpense), meta: pageMeta(q, total) };
  }

  /** Shared decision flow: lock expense row, validate state + self-approval, run `check` (budget), write approval + status atomically. */
  private async decide(u: AuthUser, expenseId: string, decision: ApprovalDecision, comment: string | undefined, opts: { from: (s: ExpenseStatus) => boolean; to: ExpenseStatus; withBudget: boolean }) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Expense" WHERE id = ${expenseId} AND "organisationId" = ${u.organisationId!} FOR UPDATE`;
      const e = await tx.expense.findFirst({ where: { id: expenseId, organisationId: u.organisationId! }, include: { employee: true } });
      if (!e) throw new NotFoundException('Expense not found');
      if (isSelfApproval(u.userId, e.employee.userId)) throw new ForbiddenException('You cannot approve, reject or reimburse your own expense');
      if (!opts.from(e.status)) throw new ConflictException(`Expense is ${e.status}; this action is not allowed`);

      if (opts.withBudget) {
        const r = await this.guard.reserve(tx, { organisationId: e.organisationId, departmentId: e.employee.departmentId, date: e.expenseDate, amount: e.amount, label: `expense ${e.merchant}` });
        if (!r.ok) throw new UnprocessableEntityException(`Approving would exceed budget "${r.budgetName}" (remaining ${r.remaining} ${e.currency})`);
      }
      await tx.expense.update({ where: { id: e.id }, data: { status: opts.to } });
      await tx.approval.create({ data: { organisationId: e.organisationId, expenseId: e.id, approverId: u.userId, decision, comment } });
      await this.audit.log({ organisationId: e.organisationId, actorId: u.userId, action: `EXPENSE_${decision}`, entityType: 'Expense', entityId: e.id, metadata: { amount: e.amount.toFixed(2), comment } }, tx);
      await this.notifications.notify(e.organisationId, e.employee.userId, `Expense ${decision.toLowerCase()}`, `${e.merchant} (${e.amount.toFixed(2)} ${e.currency}) was ${decision.toLowerCase()}${comment ? `: ${comment}` : ''}`, tx);
    });
    return this.expenses.get(u, expenseId);
  }

  approve(u: AuthUser, id: string, comment?: string) { return this.decide(u, id, 'APPROVED', comment, { from: canDecide, to: 'APPROVED', withBudget: true }); }
  reject(u: AuthUser, id: string, reason: string) { return this.decide(u, id, 'REJECTED', reason, { from: canDecide, to: 'REJECTED', withBudget: false }); }
  reimburse(u: AuthUser, id: string, comment?: string) { return this.decide(u, id, 'REIMBURSED', comment, { from: canReimburse, to: 'REIMBURSED', withBudget: false }); }

  async history(u: AuthUser, expenseId: string) {
    await this.expenses.load(u, expenseId); // enforces tenant + ownership visibility
    const rows = await this.prisma.approval.findMany({ where: { expenseId, organisationId: u.organisationId! }, orderBy: { createdAt: 'asc' } });
    const users = await this.prisma.user.findMany({ where: { id: { in: rows.map((r) => r.approverId) } }, select: { id: true, firstName: true, lastName: true } });
    return rows.map((r) => ({ ...r, approverName: (() => { const x = users.find((y) => y.id === r.approverId); return x ? `${x.firstName} ${x.lastName}` : null; })() }));
  }
}

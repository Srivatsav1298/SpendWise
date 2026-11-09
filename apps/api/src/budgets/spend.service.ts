import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { D, Money, sum } from '../common/money';
import { spendRows } from '../common/spend';
import { monthRange } from '../expenses/expense-rules';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class SpendService {
  /** Employee's committed month-to-date spend: pending+approved+reimbursed expenses and approved card transactions. */
  async employeeMonthSpend(db: Db, organisationId: string, employeeId: string, date: Date, excludeExpenseId?: string): Promise<Money> {
    const { start, end } = monthRange(date);
    const endExclusive = new Date(end.getTime() + 86400_000);
    const [exp, txn] = await Promise.all([
      db.expense.aggregate({
        _sum: { amount: true },
        where: { organisationId, employeeId, status: { in: ['SUBMITTED', 'APPROVED', 'REIMBURSED'] }, expenseDate: { gte: start, lte: end }, ...(excludeExpenseId ? { id: { not: excludeExpenseId } } : {}) },
      }),
      db.transaction.aggregate({ _sum: { amount: true }, where: { organisationId, employeeId, status: 'APPROVED', occurredAt: { gte: start, lt: endExclusive } } }),
    ]);
    return sum([exp._sum.amount ?? 0, txn._sum.amount ?? 0]);
  }

  async cardSpend(db: Db, cardId: string, from: Date, toExclusive: Date): Promise<Money> {
    const r = await db.transaction.aggregate({ _sum: { amount: true }, where: { cardId, status: 'APPROVED', occurredAt: { gte: from, lt: toExclusive } } });
    return D(r._sum.amount ?? 0);
  }

  /** Spend consumed against a budget: all org spend (or one department's) within the budget period. */
  async budgetConsumption(db: Db, organisationId: string, b: { departmentId: string | null; periodStart: Date; periodEnd: Date }): Promise<Money> {
    const dept = b.departmentId ? Prisma.sql`WHERE s."departmentId" = ${b.departmentId}` : Prisma.empty;
    const rows = await db.$queryRaw<{ total: string }[]>(
      Prisma.sql`SELECT COALESCE(SUM(s.amount), 0)::text AS total FROM (${spendRows(organisationId, b.periodStart, b.periodEnd)}) s ${dept}`,
    );
    return D(rows[0]?.total ?? 0);
  }
}

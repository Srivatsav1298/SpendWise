import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SpendService } from './spend.service';
import { D } from '../common/money';
import { exceedsBudget, newlyCrossedThresholds } from './budget-rules';

export type ReserveResult = { ok: true } | { ok: false; budgetName: string; remaining: string };

/**
 * Backend enforcement point for budgets. MUST be called inside a DB transaction, immediately before the
 * spending row is written/approved. Budget rows are locked FOR UPDATE so concurrent approvals/transactions
 * against the same budget are serialised and cannot both squeeze under the cap.
 */
@Injectable()
export class BudgetGuardService {
  constructor(private spend: SpendService, private notifications: NotificationsService, private prisma: PrismaService) {}

  async reserve(tx: Prisma.TransactionClient, p: { organisationId: string; departmentId: string | null; date: Date; amount: Prisma.Decimal.Value; label: string }): Promise<ReserveResult> {
    const deptFilter = p.departmentId ? Prisma.sql`("departmentId" IS NULL OR "departmentId" = ${p.departmentId})` : Prisma.sql`"departmentId" IS NULL`;
    const locked = await tx.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT id FROM "Budget" WHERE "organisationId" = ${p.organisationId} AND "periodStart" <= ${p.date} AND "periodEnd" >= ${p.date} AND ${deptFilter} ORDER BY id FOR UPDATE`,
    );
    if (!locked.length) return { ok: true };
    const budgets = await tx.budget.findMany({ where: { id: { in: locked.map((l) => l.id) } } });

    const consumptions = [];
    for (const b of budgets) {
      const spent = await this.spend.budgetConsumption(tx, p.organisationId, b);
      if (exceedsBudget(spent, p.amount, b.amount)) {
        return { ok: false, budgetName: b.name, remaining: D(b.amount).minus(spent).toFixed(2) };
      }
      consumptions.push({ b, spent });
    }
    // All budgets have room: record threshold alerts (once each).
    for (const { b, spent } of consumptions) {
      const crossed = newlyCrossedThresholds(spent, spent.plus(p.amount), b.amount, b.thresholdsNotified);
      if (!crossed.length) continue;
      await tx.budget.update({ where: { id: b.id }, data: { thresholdsNotified: { set: [...b.thresholdsNotified, ...crossed] } } });
      for (const t of crossed) {
        await this.notifications.notifyRoles(p.organisationId, ['ORG_ADMIN', 'FINANCE_MANAGER'], `Budget alert: ${b.name} at ${t}%`, `"${b.name}" has reached ${t}% of its ${D(b.amount).toFixed(2)} ${b.currency} budget (triggered by ${p.label}).`, tx);
      }
    }
    return { ok: true };
  }
}

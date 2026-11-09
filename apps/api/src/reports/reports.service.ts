import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BudgetsService } from '../budgets/budgets.service';
import { AuthUser, isManager } from '../common/auth-user';
import { D, fmt, pct } from '../common/money';
import { spendRows } from '../common/spend';

export interface Range { from: Date; to: Date }
export const defaultRange = (from?: string, to?: string): Range => {
  const now = new Date();
  const t = to ? new Date(to) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const f = from ? new Date(from) : new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 11, 1));
  return { from: f, to: t };
};

type Row = { key: string; label?: string; total: string; count?: number };

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService, private budgets: BudgetsService) {}

  private src(org: string, r: Range, employeeId?: string) {
    const filter = employeeId ? Prisma.sql`WHERE s."employeeId" = ${employeeId}` : Prisma.empty;
    return Prisma.sql`(SELECT * FROM (${spendRows(org, r.from, r.to)}) s ${filter})`;
  }

  async total(org: string, r: Range, employeeId?: string) {
    const rows = await this.prisma.$queryRaw<{ t: string }[]>(Prisma.sql`SELECT COALESCE(SUM(amount),0)::text AS t FROM ${this.src(org, r, employeeId)} x`);
    return D(rows[0].t);
  }

  async byMonth(org: string, r: Range, employeeId?: string): Promise<Row[]> {
    const rows = await this.prisma.$queryRaw<{ key: string; total: string; count: bigint }[]>(
      Prisma.sql`SELECT to_char(date_trunc('month', x.d), 'YYYY-MM') AS key, SUM(x.amount)::text AS total, COUNT(*) AS count FROM ${this.src(org, r, employeeId)} x GROUP BY 1 ORDER BY 1`,
    );
    return rows.map((x) => ({ key: x.key, total: fmt(x.total)!, count: Number(x.count) }));
  }

  async byCategory(org: string, r: Range, employeeId?: string): Promise<Row[]> {
    const rows = await this.prisma.$queryRaw<{ key: string; total: string; count: bigint }[]>(
      Prisma.sql`SELECT x.category AS key, SUM(x.amount)::text AS total, COUNT(*) AS count FROM ${this.src(org, r, employeeId)} x GROUP BY 1 ORDER BY SUM(x.amount) DESC`,
    );
    return rows.map((x) => ({ key: x.key, total: fmt(x.total)!, count: Number(x.count) }));
  }

  async byDepartment(org: string, r: Range): Promise<Row[]> {
    const rows = await this.prisma.$queryRaw<{ key: string; label: string; total: string; count: bigint }[]>(
      Prisma.sql`SELECT COALESCE(x."departmentId", 'none') AS key, COALESCE(d.name, 'Unassigned') AS label, SUM(x.amount)::text AS total, COUNT(*) AS count
        FROM ${this.src(org, r)} x LEFT JOIN "Department" d ON d.id = x."departmentId" GROUP BY 1, 2 ORDER BY SUM(x.amount) DESC`,
    );
    return rows.map((x) => ({ key: x.key, label: x.label, total: fmt(x.total)!, count: Number(x.count) }));
  }

  async byEmployee(org: string, r: Range): Promise<Row[]> {
    const rows = await this.prisma.$queryRaw<{ key: string; label: string; total: string; count: bigint }[]>(
      Prisma.sql`SELECT x."employeeId" AS key, u."firstName" || ' ' || u."lastName" AS label, SUM(x.amount)::text AS total, COUNT(*) AS count
        FROM ${this.src(org, r)} x JOIN "Employee" e ON e.id = x."employeeId" JOIN "User" u ON u.id = e."userId" GROUP BY 1, 2 ORDER BY SUM(x.amount) DESC`,
    );
    return rows.map((x) => ({ key: x.key, label: x.label, total: fmt(x.total)!, count: Number(x.count) }));
  }

  async budgetUtilisation(org: string) { return this.budgets.list(org); }

  async dashboard(u: AuthUser, range: Range) {
    const org = u.organisationId!;
    const manager = isManager(u);
    const scope = manager ? undefined : (u.employeeId ?? '__none__');
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const expenseScope: Prisma.ExpenseWhereInput = { organisationId: org, ...(scope ? { employeeId: scope } : {}) };
    const [totalSpend, monthSpend, monthly, categories, departments, pendingAgg, recent, budgetList] = await Promise.all([
      this.total(org, range, scope),
      this.total(org, { from: monthStart, to: today }, scope),
      this.byMonth(org, range, scope),
      this.byCategory(org, range, scope),
      manager ? this.byDepartment(org, range) : Promise.resolve([] as Row[]),
      this.prisma.expense.aggregate({ _count: true, _sum: { amount: true }, where: { ...expenseScope, status: 'SUBMITTED', ...(manager ? { employee: { userId: { not: u.userId } } } : {}) } }),
      this.prisma.transaction.findMany({ where: { organisationId: org, ...(scope ? { employeeId: scope } : {}) }, orderBy: { occurredAt: 'desc' }, take: 10 }),
      manager ? this.budgets.list(org) : Promise.resolve([] as any[]),
    ]);

    // Budgets whose period covers today drive "available budget" and utilisation.
    const active = budgetList.filter((b: any) => new Date(b.periodStart) <= today && new Date(b.periodEnd) >= today);
    // Department budgets nest inside an org-wide budget, so the headline uses org-wide budgets when any exist
    // (otherwise summing both would double-count the same spend); with none, it sums the department budgets.
    const orgWide = active.filter((b: any) => !b.departmentId);
    const headline = orgWide.length ? orgWide : active;
    const totalBudget = headline.reduce((a: Prisma.Decimal, b: any) => a.plus(b.amount), D(0));
    const budgetSpent = headline.reduce((a: Prisma.Decimal, b: any) => a.plus(b.spent), D(0));

    return {
      scope: manager ? 'organisation' : 'personal',
      range: { from: range.from, to: range.to },
      totalSpend: fmt(totalSpend), monthSpend: fmt(monthSpend),
      budget: manager ? { total: fmt(totalBudget), spent: fmt(budgetSpent), available: fmt(totalBudget.minus(budgetSpent)), utilisationPct: pct(budgetSpent, totalBudget).toNumber() } : null,
      pendingApprovals: { count: pendingAgg._count, amount: fmt(pendingAgg._sum.amount ?? 0) },
      recentTransactions: recent.map((t) => ({ id: t.id, merchant: t.merchant, category: t.category, amount: fmt(t.amount), status: t.status, flagged: t.flagged, occurredAt: t.occurredAt })),
      byDepartment: departments, monthlyTrend: monthly, byCategory: categories,
      activeBudgets: active,
    };
  }
}

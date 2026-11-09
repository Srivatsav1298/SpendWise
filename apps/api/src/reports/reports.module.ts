import { Controller, Get, Module, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional } from 'class-validator';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { ReportsService, defaultRange } from './reports.service';
import { toCsv } from './csv';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/auth-user';

class ReportQuery {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsIn(['json', 'csv']) format?: 'json' | 'csv';
}

@ApiTags('reports') @ApiBearerAuth() @Controller('reports')
export class ReportsController {
  constructor(private svc: ReportsService) {}

  @Get('dashboard') dashboard(@CurrentUser() u: AuthUser, @Query() q: ReportQuery) { return this.svc.dashboard(u, defaultRange(q.from, q.to)); }

  private out(res: Response, q: ReportQuery, name: string, headers: string[], rows: (string | number | null)[][], json: unknown) {
    if (q.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${name}.csv"`);
      res.send(toCsv(headers, rows));
      return;
    }
    res.json({ data: json });
  }

  @Get('monthly') @Roles(Role.ORG_ADMIN, Role.FINANCE_MANAGER)
  async monthly(@CurrentUser() u: AuthUser, @Query() q: ReportQuery, @Res() res: Response) {
    const rows = await this.svc.byMonth(u.organisationId!, defaultRange(q.from, q.to));
    this.out(res, q, 'monthly-spending', ['Month', 'Total', 'Items'], rows.map((r) => [r.key, r.total, r.count!]), rows);
  }
  @Get('departments') @Roles(Role.ORG_ADMIN, Role.FINANCE_MANAGER)
  async departments(@CurrentUser() u: AuthUser, @Query() q: ReportQuery, @Res() res: Response) {
    const rows = await this.svc.byDepartment(u.organisationId!, defaultRange(q.from, q.to));
    this.out(res, q, 'department-spending', ['Department', 'Total', 'Items'], rows.map((r) => [r.label!, r.total, r.count!]), rows);
  }
  @Get('employees') @Roles(Role.ORG_ADMIN, Role.FINANCE_MANAGER)
  async employees(@CurrentUser() u: AuthUser, @Query() q: ReportQuery, @Res() res: Response) {
    const rows = await this.svc.byEmployee(u.organisationId!, defaultRange(q.from, q.to));
    this.out(res, q, 'employee-spending', ['Employee', 'Total', 'Items'], rows.map((r) => [r.label!, r.total, r.count!]), rows);
  }
  @Get('categories') @Roles(Role.ORG_ADMIN, Role.FINANCE_MANAGER)
  async categories(@CurrentUser() u: AuthUser, @Query() q: ReportQuery, @Res() res: Response) {
    const rows = await this.svc.byCategory(u.organisationId!, defaultRange(q.from, q.to));
    this.out(res, q, 'category-spending', ['Category', 'Total', 'Items'], rows.map((r) => [r.key, r.total, r.count!]), rows);
  }
  @Get('budget-utilisation') @Roles(Role.ORG_ADMIN, Role.FINANCE_MANAGER)
  async budgets(@CurrentUser() u: AuthUser, @Query() q: ReportQuery, @Res() res: Response) {
    const rows = await this.svc.budgetUtilisation(u.organisationId!);
    this.out(res, q, 'budget-utilisation', ['Budget', 'Department', 'Amount', 'Spent', 'Remaining', 'Utilisation %', 'Period start', 'Period end'],
      rows.map((b: any) => [b.name, b.department ?? 'Organisation-wide', b.amount, b.spent, b.remaining, b.utilisationPct, new Date(b.periodStart).toISOString().slice(0, 10), new Date(b.periodEnd).toISOString().slice(0, 10)]), rows);
  }
}

@Module({ controllers: [ReportsController], providers: [ReportsService] })
export class ReportsModule {}

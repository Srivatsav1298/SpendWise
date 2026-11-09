import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto, PolicyDto, UpdateBudgetDto } from './dto';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/auth-user';

@ApiTags('budgets') @ApiBearerAuth() @Controller()
export class BudgetsController {
  constructor(private svc: BudgetsService) {}

  @Get('budgets') @Roles(Role.ORG_ADMIN, Role.FINANCE_MANAGER)
  list(@CurrentUser() u: AuthUser) { return this.svc.list(u.organisationId!); }
  @Get('budgets/:id') @Roles(Role.ORG_ADMIN, Role.FINANCE_MANAGER)
  get(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.svc.get(u.organisationId!, id); }
  @Post('budgets') @Roles(Role.ORG_ADMIN)
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateBudgetDto) { return this.svc.create(u.organisationId!, u.userId, dto); }
  @Patch('budgets/:id') @Roles(Role.ORG_ADMIN)
  update(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBudgetDto) { return this.svc.update(u.organisationId!, u.userId, id, dto); }
  @Delete('budgets/:id') @Roles(Role.ORG_ADMIN)
  remove(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.svc.remove(u.organisationId!, u.userId, id); }

  @Get('policies') @Roles(Role.ORG_ADMIN, Role.FINANCE_MANAGER)
  policies(@CurrentUser() u: AuthUser) { return this.svc.listPolicies(u.organisationId!); }
  @Post('policies') @Roles(Role.ORG_ADMIN)
  createPolicy(@CurrentUser() u: AuthUser, @Body() dto: PolicyDto) { return this.svc.createPolicy(u.organisationId!, u.userId, dto); }
  @Patch('policies/:id') @Roles(Role.ORG_ADMIN)
  updatePolicy(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PolicyDto) { return this.svc.updatePolicy(u.organisationId!, u.userId, id, dto); }
  @Delete('policies/:id') @Roles(Role.ORG_ADMIN)
  removePolicy(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.svc.removePolicy(u.organisationId!, u.userId, id); }
}

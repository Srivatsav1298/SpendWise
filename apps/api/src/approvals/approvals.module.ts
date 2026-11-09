import { Body, Controller, Get, Module, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ApprovalsService } from './approvals.service';
import { DecisionDto, RejectDto } from '../expenses/dto';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/auth-user';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ExpensesModule } from '../expenses/expenses.module';

@ApiTags('approvals') @ApiBearerAuth() @Controller('approvals')
export class ApprovalsController {
  constructor(private svc: ApprovalsService) {}
  @Get('pending') @Roles(Role.ORG_ADMIN, Role.FINANCE_MANAGER) pending(@CurrentUser() u: AuthUser, @Query() q: PaginationDto) { return this.svc.pending(u, q); }
  @Get('expense/:id') history(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.svc.history(u, id); }
  @Post(':id/approve') @Roles(Role.ORG_ADMIN, Role.FINANCE_MANAGER) approve(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecisionDto) { return this.svc.approve(u, id, dto.comment); }
  @Post(':id/reject') @Roles(Role.ORG_ADMIN, Role.FINANCE_MANAGER) reject(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectDto) { return this.svc.reject(u, id, dto.reason); }
  @Post(':id/reimburse') @Roles(Role.ORG_ADMIN, Role.FINANCE_MANAGER) reimburse(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecisionDto) { return this.svc.reimburse(u, id, dto.comment); }
}

@Module({ imports: [ExpensesModule], controllers: [ApprovalsController], providers: [ApprovalsService] })
export class ApprovalsModule {}

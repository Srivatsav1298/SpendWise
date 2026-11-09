import { Body, Controller, Get, Module, Param, ParseUUIDPipe, Patch, Post, Query, ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { EmployeesService } from './employees.service';
import { EmployeeQuery, InviteDto, UpdateEmployeeDto } from './dto';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/auth-user';

@ApiTags('employees') @ApiBearerAuth() @Controller('employees')
export class EmployeesController {
  constructor(private svc: EmployeesService) {}

  @Get('me/limits') myLimits(@CurrentUser() u: AuthUser) {
    if (!u.employeeId) throw new ForbiddenException('No employee profile');
    return this.svc.myLimits(u.organisationId!, u.employeeId);
  }
  @Get('me') me(@CurrentUser() u: AuthUser) {
    if (!u.employeeId) throw new ForbiddenException('No employee profile');
    return this.svc.get(u.organisationId!, u.employeeId);
  }

  @Get() @Roles(Role.ORG_ADMIN, Role.FINANCE_MANAGER) list(@CurrentUser() u: AuthUser, @Query() q: EmployeeQuery) { return this.svc.list(u.organisationId!, q); }
  @Get('invitations') @Roles(Role.ORG_ADMIN) invitations(@CurrentUser() u: AuthUser) { return this.svc.listInvitations(u.organisationId!); }
  @Post('invite') @Roles(Role.ORG_ADMIN) invite(@CurrentUser() u: AuthUser, @Body() dto: InviteDto) { return this.svc.invite(u.organisationId!, u.userId, dto); }
  @Get(':id') @Roles(Role.ORG_ADMIN, Role.FINANCE_MANAGER) get(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.svc.get(u.organisationId!, id); }
  @Patch(':id') @Roles(Role.ORG_ADMIN) update(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEmployeeDto) { return this.svc.update(u.organisationId!, u.userId, id, dto); }
  @Post(':id/deactivate') @Roles(Role.ORG_ADMIN) deactivate(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.svc.setActive(u.organisationId!, u.userId, id, false); }
  @Post(':id/activate') @Roles(Role.ORG_ADMIN) activate(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.svc.setActive(u.organisationId!, u.userId, id, true); }
}

@Module({ controllers: [EmployeesController], providers: [EmployeesService] })
export class EmployeesModule {}

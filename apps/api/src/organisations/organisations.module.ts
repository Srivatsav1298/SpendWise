import { Body, Controller, Get, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CurrentUser, Roles, SuperAdminOnly } from '../common/decorators';
import { AuthUser } from '../common/auth-user';
import { PaginationDto, pageArgs, pageMeta } from '../common/dto/pagination.dto';
import { MONEY } from '../budgets/dto';

class UpdateOrgDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @Matches(MONEY) requireReceiptOver?: string;
}
class OrgStatusDto { @IsEnum(['ACTIVE', 'SUSPENDED']) status: 'ACTIVE' | 'SUSPENDED'; }

@Injectable()
export class OrganisationsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}
  async current(orgId: string) {
    const o = await this.prisma.organisation.findUnique({ where: { id: orgId } });
    if (!o) throw new NotFoundException();
    return { ...o, requireReceiptOver: o.requireReceiptOver.toFixed(2) };
  }
  async update(orgId: string, actorId: string, dto: UpdateOrgDto) {
    await this.prisma.organisation.update({ where: { id: orgId }, data: dto });
    await this.audit.log({ organisationId: orgId, actorId, action: 'ORG_UPDATED', entityType: 'Organisation', entityId: orgId, metadata: { ...dto } });
    return this.current(orgId);
  }
  async platformList(q: PaginationDto) {
    const [items, total] = await Promise.all([
      this.prisma.organisation.findMany({ orderBy: { createdAt: 'desc' }, ...pageArgs(q), include: { _count: { select: { memberships: true, expenses: true } } } }),
      this.prisma.organisation.count(),
    ]);
    return { items, meta: pageMeta(q, total) };
  }
  async setStatus(actorId: string, id: string, status: 'ACTIVE' | 'SUSPENDED') {
    const o = await this.prisma.organisation.update({ where: { id }, data: { status } }).catch(() => null);
    if (!o) throw new NotFoundException('Organisation not found');
    await this.audit.log({ organisationId: id, actorId, action: `ORG_${status}`, entityType: 'Organisation', entityId: id });
    return o;
  }
}

@ApiTags('organisations') @ApiBearerAuth() @Controller()
export class OrganisationsController {
  constructor(private svc: OrganisationsService) {}
  @Get('organisations/current') current(@CurrentUser() u: AuthUser) { return this.svc.current(u.organisationId!); }
  @Patch('organisations/current') @Roles(Role.ORG_ADMIN) update(@CurrentUser() u: AuthUser, @Body() dto: UpdateOrgDto) { return this.svc.update(u.organisationId!, u.userId, dto); }

  @SuperAdminOnly() @Get('platform/organisations') platformList(@Query() q: PaginationDto) { return this.svc.platformList(q); }
  @SuperAdminOnly() @Patch('platform/organisations/:id/status')
  setStatus(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: OrgStatusDto) { return this.svc.setStatus(u.userId, id, dto.status); }
}

@Module({ controllers: [OrganisationsController], providers: [OrganisationsService] })
export class OrganisationsModule {}

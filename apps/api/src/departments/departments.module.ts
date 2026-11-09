import { Body, ConflictException, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/auth-user';

export class DepartmentDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @MinLength(2) @MaxLength(80) name: string;
}

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}
  list(orgId: string) {
    return this.prisma.department.findMany({ where: { organisationId: orgId }, orderBy: { name: 'asc' }, include: { _count: { select: { employees: true } } } });
  }
  async create(orgId: string, actorId: string, dto: DepartmentDto) {
    const d = await this.prisma.department.create({ data: { organisationId: orgId, name: dto.name } });
    await this.audit.log({ organisationId: orgId, actorId, action: 'DEPARTMENT_CREATED', entityType: 'Department', entityId: d.id });
    return d;
  }
  async update(orgId: string, actorId: string, id: string, dto: DepartmentDto) {
    const r = await this.prisma.department.updateMany({ where: { id, organisationId: orgId }, data: { name: dto.name } });
    if (!r.count) throw new NotFoundException('Department not found');
    await this.audit.log({ organisationId: orgId, actorId, action: 'DEPARTMENT_UPDATED', entityType: 'Department', entityId: id });
    return this.prisma.department.findUnique({ where: { id } });
  }
  async remove(orgId: string, actorId: string, id: string) {
    const d = await this.prisma.department.findFirst({ where: { id, organisationId: orgId }, include: { _count: { select: { employees: true } } } });
    if (!d) throw new NotFoundException('Department not found');
    if (d._count.employees) throw new ConflictException('Reassign employees before deleting this department');
    await this.prisma.department.delete({ where: { id } });
    await this.audit.log({ organisationId: orgId, actorId, action: 'DEPARTMENT_DELETED', entityType: 'Department', entityId: id });
    return { ok: true };
  }
}

@ApiTags('departments') @ApiBearerAuth() @Controller('departments')
export class DepartmentsController {
  constructor(private svc: DepartmentsService) {}
  @Get() list(@CurrentUser() u: AuthUser) { return this.svc.list(u.organisationId!); }
  @Post() @Roles(Role.ORG_ADMIN) create(@CurrentUser() u: AuthUser, @Body() dto: DepartmentDto) { return this.svc.create(u.organisationId!, u.userId, dto); }
  @Patch(':id') @Roles(Role.ORG_ADMIN) update(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DepartmentDto) { return this.svc.update(u.organisationId!, u.userId, id, dto); }
  @Delete(':id') @Roles(Role.ORG_ADMIN) remove(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.svc.remove(u.organisationId!, u.userId, id); }
}

@Module({ controllers: [DepartmentsController], providers: [DepartmentsService] })
export class DepartmentsModule {}

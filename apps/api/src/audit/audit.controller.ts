import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { Role } from '@prisma/client';
import { AuditService } from './audit.service';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/auth-user';
import { PaginationDto } from '../common/dto/pagination.dto';

class AuditQuery extends PaginationDto {
  @IsOptional() @IsString() entityType?: string;
}

@ApiTags('audit-logs') @ApiBearerAuth() @Controller('audit-logs')
export class AuditController {
  constructor(private audit: AuditService) {}
  @Get() @Roles(Role.ORG_ADMIN, Role.FINANCE_MANAGER)
  list(@CurrentUser() u: AuthUser, @Query() q: AuditQuery) {
    return this.audit.list(u.organisationId!, q);
  }
}

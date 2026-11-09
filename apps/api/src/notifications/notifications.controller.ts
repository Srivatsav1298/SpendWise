import { Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../common/decorators';
import { AuthUser } from '../common/auth-user';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('notifications') @ApiBearerAuth() @Controller('notifications')
export class NotificationsController {
  constructor(private svc: NotificationsService) {}
  @Get() list(@CurrentUser() u: AuthUser, @Query() q: PaginationDto) { return this.svc.list(u.userId, u.organisationId!, q); }
  @Post('read-all') readAll(@CurrentUser() u: AuthUser) { return this.svc.markAllRead(u.userId, u.organisationId!); }
  @Patch(':id/read') read(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.markRead(id, u.userId); }
}

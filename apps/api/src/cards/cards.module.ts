import { Body, Controller, Get, Module, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CardsService } from './cards.service';
import { CardStatusDto, IssueCardDto, UpdateCardDto } from './dto';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/auth-user';

@ApiTags('cards') @ApiBearerAuth() @Controller('cards')
export class CardsController {
  constructor(private svc: CardsService) {}
  @Get() list(@CurrentUser() u: AuthUser) { return this.svc.list(u); }
  @Get(':id') get(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.svc.get(u, id); }
  @Post() @Roles(Role.ORG_ADMIN, Role.FINANCE_MANAGER) issue(@CurrentUser() u: AuthUser, @Body() dto: IssueCardDto) { return this.svc.issue(u, dto); }
  @Patch(':id') @Roles(Role.ORG_ADMIN, Role.FINANCE_MANAGER) update(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCardDto) { return this.svc.update(u, id, dto); }
  @Post(':id/status') setStatus(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CardStatusDto) { return this.svc.setStatus(u, id, dto); }
}

@Module({ controllers: [CardsController], providers: [CardsService], exports: [CardsService] })
export class CardsModule {}

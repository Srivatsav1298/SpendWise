import { Body, Controller, Delete, Get, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto, ExpenseQuery, UpdateExpenseDto } from './dto';
import { CurrentUser } from '../common/decorators';
import { AuthUser } from '../common/auth-user';

@ApiTags('expenses') @ApiBearerAuth() @Controller('expenses')
export class ExpensesController {
  constructor(private svc: ExpensesService) {}
  @Post() create(@CurrentUser() u: AuthUser, @Body() dto: CreateExpenseDto) { return this.svc.create(u, dto); }
  @Get() list(@CurrentUser() u: AuthUser, @Query() q: ExpenseQuery) { return this.svc.list(u, q); }
  @Get(':id') get(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.svc.get(u, id); }
  @Patch(':id') update(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateExpenseDto) { return this.svc.update(u, id, dto); }
  @Delete(':id') remove(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.svc.remove(u, id); }
  @Post(':id/submit') submit(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.svc.submit(u, id); }
}

@Module({ controllers: [ExpensesController], providers: [ExpensesService], exports: [ExpensesService] })
export class ExpensesModule {}

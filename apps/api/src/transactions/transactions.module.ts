import { Body, Controller, Get, Headers, HttpCode, Module, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { SimulateTransactionDto, TransactionQuery } from './dto';
import { CurrentUser } from '../common/decorators';
import { AuthUser } from '../common/auth-user';

@ApiTags('transactions') @ApiBearerAuth() @Controller('transactions')
export class TransactionsController {
  constructor(private svc: TransactionsService) {}
  @Get() list(@CurrentUser() u: AuthUser, @Query() q: TransactionQuery) { return this.svc.list(u, q); }
  @Get(':id') get(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.svc.get(u, id); }
  @Post('simulate') @HttpCode(201) @ApiHeader({ name: 'Idempotency-Key', required: false })
  simulate(@CurrentUser() u: AuthUser, @Body() dto: SimulateTransactionDto, @Headers('idempotency-key') key?: string) { return this.svc.simulate(u, dto, key); }
}

@Module({ controllers: [TransactionsController], providers: [TransactionsService] })
export class TransactionsModule {}

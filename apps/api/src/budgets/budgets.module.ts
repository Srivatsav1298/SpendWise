import { Global, Module } from '@nestjs/common';
import { BudgetsController } from './budgets.controller';
import { BudgetsService } from './budgets.service';
import { SpendService } from './spend.service';
import { BudgetGuardService } from './budget-guard.service';

@Global()
@Module({ controllers: [BudgetsController], providers: [BudgetsService, SpendService, BudgetGuardService], exports: [SpendService, BudgetGuardService, BudgetsService] })
export class BudgetsModule {}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SpendService } from '../budgets/spend.service';
import { BudgetGuardService } from '../budgets/budget-guard.service';
import { AuthUser, isManager } from '../common/auth-user';
import { pageArgs, pageMeta } from '../common/dto/pagination.dto';
import { fmt } from '../common/money';
import { evaluateCardTransaction } from '../cards/card-rules';
import { SimulateTransactionDto, TransactionQuery } from './dto';

const present = (t: any) => ({
  id: t.id, cardId: t.cardId, employeeId: t.employeeId, amount: fmt(t.amount), currency: t.currency, merchant: t.merchant, category: t.category,
  status: t.status, declineReason: t.declineReason, flagged: t.flagged, flagReason: t.flagReason, occurredAt: t.occurredAt, simulated: true,
});

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService, private audit: AuditService, private notifications: NotificationsService, private spend: SpendService, private guard: BudgetGuardService) {}

  async list(u: AuthUser, q: TransactionQuery) {
    const manager = isManager(u);
    const where: Prisma.TransactionWhereInput = {
      organisationId: u.organisationId!,
      ...(manager ? (q.employeeId ? { employeeId: q.employeeId } : {}) : { employeeId: u.employeeId ?? '__none__' }),
      ...(q.cardId ? { cardId: q.cardId } : {}), ...(q.status ? { status: q.status } : {}), ...(q.flagged !== undefined ? { flagged: q.flagged } : {}),
      ...(q.from || q.to ? { occurredAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.transaction.findMany({ where, orderBy: { occurredAt: 'desc' }, ...pageArgs(q) }),
      this.prisma.transaction.count({ where }),
    ]);
    return { items: rows.map(present), meta: pageMeta(q, total) };
  }

  async get(u: AuthUser, id: string) {
    const t = await this.prisma.transaction.findFirst({ where: { id, organisationId: u.organisationId! } });
    if (!t || (!isManager(u) && t.employeeId !== u.employeeId)) throw new NotFoundException('Transaction not found');
    return present(t);
  }

  /**
   * Simulates a card authorisation. Everything (limit checks, budget reservation, insert, audit) happens in ONE
   * transaction with the card row locked, so concurrent swipes can't jointly breach a limit.
   * Idempotent on (cardId, Idempotency-Key): a retry returns the original outcome and creates nothing new.
   */
  async simulate(u: AuthUser, dto: SimulateTransactionDto, idempotencyKey?: string) {
    if (idempotencyKey && idempotencyKey.length > 128) throw new BadRequestException('Idempotency-Key too long');
    const card = await this.prisma.corporateCard.findFirst({ where: { id: dto.cardId, organisationId: u.organisationId! }, include: { employee: true } });
    if (!card || (!isManager(u) && card.employeeId !== u.employeeId)) throw new NotFoundException('Card not found');

    if (idempotencyKey) {
      const prior = await this.prisma.transaction.findUnique({ where: { cardId_idempotencyKey: { cardId: card.id, idempotencyKey } } });
      if (prior) return { ...present(prior), replayed: true };
    }
    try {
      const t = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "CorporateCard" WHERE id = ${card.id} FOR UPDATE`;
        const fresh = await tx.corporateCard.findUniqueOrThrow({ where: { id: card.id }, include: { employee: true } });
        const now = new Date();
        const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const farFuture = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1));
        const [spentToday, spentMonth, empSpent, policies] = await Promise.all([
          this.spend.cardSpend(tx, card.id, dayStart, farFuture),
          this.spend.cardSpend(tx, card.id, monthStart, farFuture),
          this.spend.employeeMonthSpend(tx, card.organisationId, card.employeeId, now),
          tx.spendingPolicy.findMany({ where: { organisationId: card.organisationId, isActive: true, maxAmountPerExpense: { not: null }, OR: [{ category: null }, { category: { equals: dto.category, mode: 'insensitive' } }] } }),
        ]);
        const policyMax = policies.reduce<Prisma.Decimal | null>((m, p) => (m === null || p.maxAmountPerExpense!.lt(m) ? p.maxAmountPerExpense! : m), null);
        let result = evaluateCardTransaction({
          status: fresh.status, currency: fresh.currency, dailyLimit: fresh.dailyLimit, monthlyLimit: fresh.monthlyLimit, blockedCategories: fresh.blockedCategories,
          amount: dto.amount, currencyOfTxn: dto.currency ?? fresh.currency, category: dto.category, spentToday, spentThisMonth: spentMonth,
          employeeMonthlyLimit: fresh.employee.monthlyLimit, employeeSpentThisMonth: empSpent, policyMaxForCategory: policyMax,
        });
        if (result.approved) {
          const r = await this.guard.reserve(tx, { organisationId: card.organisationId, departmentId: fresh.employee.departmentId, date: now, amount: dto.amount, label: `card ${dto.merchant}` });
          if (!r.ok) result = { approved: false, declineReason: `Budget "${r.budgetName}" exceeded`, flagged: true, flagReason: `Budget "${r.budgetName}" exceeded` };
        }
        const t = await tx.transaction.create({
          data: { organisationId: card.organisationId, cardId: card.id, employeeId: card.employeeId, amount: dto.amount, currency: dto.currency ?? fresh.currency, merchant: dto.merchant, category: dto.category,
            status: result.approved ? 'APPROVED' : 'DECLINED', declineReason: result.declineReason, flagged: result.flagged, flagReason: result.flagReason, idempotencyKey },
        });
        await this.audit.log({ organisationId: card.organisationId, actorId: u.userId, action: result.approved ? 'CARD_TXN_APPROVED' : 'CARD_TXN_DECLINED', entityType: 'Transaction', entityId: t.id, metadata: { amount: dto.amount, flagged: result.flagged, reason: result.declineReason ?? result.flagReason } }, tx);
        if (result.flagged) {
          await this.notifications.notifyRoles(card.organisationId, ['ORG_ADMIN', 'FINANCE_MANAGER'], 'Flagged card transaction', `${dto.merchant} ${dto.amount}: ${result.flagReason}`, tx);
        }
        if (!result.approved) await this.notifications.notify(card.organisationId, card.employee.userId, 'Card transaction declined', `${dto.merchant} ${dto.amount}: ${result.declineReason}`, tx);
        return t;
      });
      return present(t);
    } catch (e) {
      // Lost an idempotency race against a concurrent identical request: return the winner.
      if (idempotencyKey && e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const prior = await this.prisma.transaction.findUnique({ where: { cardId_idempotencyKey: { cardId: card.id, idempotencyKey } } });
        if (prior) return { ...present(prior), replayed: true };
      }
      throw e;
    }
  }
}

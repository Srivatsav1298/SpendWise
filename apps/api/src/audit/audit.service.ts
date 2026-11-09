import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, pageArgs, pageMeta } from '../common/dto/pagination.dto';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  /** Pass a transaction client so the audit row commits atomically with the financial change. */
  async log(
    entry: { organisationId?: string | null; actorId?: string | null; action: string; entityType: string; entityId?: string; metadata?: Record<string, unknown> },
    db: Db = this.prisma,
  ) {
    await db.auditLog.create({ data: { ...entry, metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined } });
  }

  async list(organisationId: string, q: PaginationDto & { entityType?: string }) {
    const where: Prisma.AuditLogWhereInput = { organisationId, ...(q.entityType ? { entityType: q.entityType } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, ...pageArgs(q) }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, meta: pageMeta(q, total) };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, pageArgs, pageMeta } from '../common/dto/pagination.dto';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  notify(organisationId: string, userId: string, title: string, body: string, db: Db = this.prisma) {
    return db.notification.create({ data: { organisationId, userId, title, body } });
  }

  /** Notify every active member holding one of the given roles. */
  async notifyRoles(organisationId: string, roles: ('ORG_ADMIN' | 'FINANCE_MANAGER')[], title: string, body: string, db: Db = this.prisma) {
    const members = await db.organisationMembership.findMany({ where: { organisationId, role: { in: roles } }, select: { userId: true } });
    if (members.length) await db.notification.createMany({ data: members.map((m) => ({ organisationId, userId: m.userId, title, body })) });
  }

  async list(userId: string, organisationId: string, q: PaginationDto) {
    const where = { userId, organisationId };
    const [items, total, unread] = await Promise.all([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, ...pageArgs(q) }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { ...where, readAt: null } }),
    ]);
    return { items, meta: { ...pageMeta(q, total), unread } };
  }

  async markRead(id: string, userId: string) {
    const res = await this.prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
    if (res.count === 0 && !(await this.prisma.notification.findFirst({ where: { id, userId } }))) throw new NotFoundException();
    return { ok: true };
  }

  async markAllRead(userId: string, organisationId: string) {
    const r = await this.prisma.notification.updateMany({ where: { userId, organisationId, readAt: null }, data: { readAt: new Date() } });
    return { updated: r.count };
  }
}

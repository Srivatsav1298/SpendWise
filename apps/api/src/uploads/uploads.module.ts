import { BadRequestException, ConflictException, Controller, ForbiddenException, Get, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { memoryStorage } from 'multer';
import * as path from 'path';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../common/decorators';
import { AuthUser, isManager } from '../common/auth-user';
import { canEdit } from '../expenses/expense-rules';

export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_RECEIPTS = 5;

/** Detect the real type from magic bytes; the client-supplied mimetype/extension is never trusted. */
export function sniffType(b: Buffer): { mime: string; ext: string } | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: 'png' };
  if (b.length >= 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  if (b.length >= 5 && b.subarray(0, 5).toString('ascii') === '%PDF-') return { mime: 'application/pdf', ext: 'pdf' };
  return null;
}
const safeName = (n: string) => path.basename(n).replace(/[^\w.\- ]/g, '_').slice(0, 120) || 'receipt';

@Injectable()
export class UploadsService {
  private dir: string;
  constructor(private prisma: PrismaService, private audit: AuditService, config: ConfigService) {
    this.dir = path.resolve(config.get('UPLOAD_DIR') ?? './uploads');
  }

  async attach(u: AuthUser, expenseId: string, file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('file is required (multipart field "file")');
    const expense = await this.prisma.expense.findFirst({ where: { id: expenseId, organisationId: u.organisationId! }, include: { _count: { select: { receipts: true } } } });
    if (!expense || (!isManager(u) && expense.employeeId !== u.employeeId)) throw new NotFoundException('Expense not found');
    if (expense.employeeId !== u.employeeId) throw new ForbiddenException('Only the expense owner can attach receipts');
    if (!canEdit(expense.status)) throw new ConflictException('Receipts can only be added while the expense is a draft or rejected');
    if (expense._count.receipts >= MAX_RECEIPTS) throw new BadRequestException(`At most ${MAX_RECEIPTS} receipts per expense`);
    const type = sniffType(file.buffer);
    if (!type) throw new BadRequestException('Unsupported file type. Allowed: JPEG, PNG, WebP, PDF');

    const key = `${u.organisationId}/${randomUUID()}.${type.ext}`;
    const full = path.join(this.dir, key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, file.buffer, { flag: 'wx' });
    try {
      const r = await this.prisma.expenseReceipt.create({
        data: { organisationId: u.organisationId!, expenseId, storageKey: key, originalName: safeName(file.originalname), mimeType: type.mime, sizeBytes: file.size, uploadedById: u.userId },
        select: { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true },
      });
      await this.audit.log({ organisationId: u.organisationId, actorId: u.userId, action: 'RECEIPT_UPLOADED', entityType: 'Expense', entityId: expenseId, metadata: { receiptId: r.id } });
      return r;
    } catch (e) {
      await fs.unlink(full).catch(() => undefined);
      throw e;
    }
  }

  async open(u: AuthUser, id: string) {
    const r = await this.prisma.expenseReceipt.findFirst({ where: { id, organisationId: u.organisationId! }, include: { expense: { select: { employeeId: true } } } });
    if (!r || (!isManager(u) && r.expense.employeeId !== u.employeeId)) throw new NotFoundException('Receipt not found');
    const full = path.resolve(this.dir, r.storageKey);
    if (!full.startsWith(this.dir + path.sep)) throw new NotFoundException(); // defence in depth
    const data = await fs.readFile(full).catch(() => null);
    if (!data) throw new NotFoundException('Receipt file missing');
    return { data, mime: r.mimeType, name: r.originalName };
  }
}

@ApiTags('receipts') @ApiBearerAuth() @Controller()
export class UploadsController {
  constructor(private svc: UploadsService) {}

  @Post('expenses/:id/receipts') @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 } }))
  upload(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file?: Express.Multer.File) { return this.svc.attach(u, id, file); }

  @Get('receipts/:id')
  async download(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const f = await this.svc.open(u, id);
    res.setHeader('Content-Type', f.mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(f.name)}"`);
    res.send(f.data);
  }
}

@Module({ controllers: [UploadsController], providers: [UploadsService] })
export class UploadsModule {}

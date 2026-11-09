import { Body, Controller, Get, Injectable, Module, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../common/decorators';
import { AuthUser } from '../common/auth-user';
import { PASSWORD_RULE } from '../auth/dto';

class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) firstName?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) lastName?: string;
}
class ChangePasswordDto {
  @IsString() @MaxLength(128) currentPassword: string;
  @Matches(PASSWORD_RULE, { message: 'Password must be 10-128 characters and contain a letter and a digit' }) newPassword: string;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}
  profile(id: string) { return this.prisma.user.findUniqueOrThrow({ where: { id }, select: { id: true, email: true, firstName: true, lastName: true, createdAt: true } }); }
  async update(id: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({ where: { id }, data: dto, select: { id: true, email: true, firstName: true, lastName: true } });
  }
  async changePassword(id: string, dto: ChangePasswordDto) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    if (!(await argon2.verify(u.passwordHash, dto.currentPassword))) throw new UnauthorizedException('Current password is incorrect');
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { passwordHash: await argon2.hash(dto.newPassword, { type: argon2.argon2id }) } }),
      this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return { ok: true };
  }
}

@ApiTags('users') @ApiBearerAuth() @Controller('users/me')
export class UsersController {
  constructor(private svc: UsersService) {}
  @Get() get(@CurrentUser() u: AuthUser) { return this.svc.profile(u.userId); }
  @Patch() update(@CurrentUser() u: AuthUser, @Body() dto: UpdateProfileDto) { return this.svc.update(u.userId, dto); }
  @Post('password') changePassword(@CurrentUser() u: AuthUser, @Body() dto: ChangePasswordDto) { return this.svc.changePassword(u.userId, dto); }
}

@Module({ controllers: [UsersController], providers: [UsersService] })
export class UsersModule {}

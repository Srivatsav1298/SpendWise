import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AcceptInviteDto, ForgotPasswordDto, LoginDto, RefreshDto, RegisterDto, ResetPasswordDto } from './dto';
import { CurrentUser, Public } from '../common/decorators';
import { AuthUser } from '../common/auth-user';
import { PrismaService } from '../prisma/prisma.service';

const strict = { default: { limit: Number(process.env.AUTH_THROTTLE_LIMIT ?? 10), ttl: 60_000 } };
const strip = ({ _refreshId, ...rest }: any) => rest;

@ApiTags('auth') @Controller('auth')
export class AuthController {
  constructor(private auth: AuthService, private prisma: PrismaService) {}

  @Public() @Throttle(strict) @Post('register')
  async register(@Body() dto: RegisterDto) { return strip(await this.auth.register(dto)); }

  @Public() @Throttle(strict) @Post('login') @HttpCode(200)
  async login(@Body() dto: LoginDto) { return strip(await this.auth.login(dto)); }

  @Public() @Throttle(strict) @Post('refresh') @HttpCode(200)
  refresh(@Body() dto: RefreshDto) { return this.auth.refresh(dto.refreshToken); }

  @Public() @Post('logout') @HttpCode(200)
  logout(@Body() dto: RefreshDto) { return this.auth.logout(dto.refreshToken); }

  @Public() @Throttle(strict) @Post('forgot-password') @HttpCode(200)
  forgot(@Body() dto: ForgotPasswordDto) { return this.auth.forgotPassword(dto.email); }

  @Public() @Throttle(strict) @Post('reset-password') @HttpCode(200)
  reset(@Body() dto: ResetPasswordDto) { return this.auth.resetPassword(dto); }

  @Public() @Throttle(strict) @Post('accept-invite')
  async accept(@Body() dto: AcceptInviteDto) { return strip(await this.auth.acceptInvite(dto)); }

  @ApiBearerAuth() @Get('me')
  async me(@CurrentUser() u: AuthUser) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: u.userId }, select: { id: true, email: true, firstName: true, lastName: true, isSuperAdmin: true } });
    const org = u.organisationId ? await this.prisma.organisation.findUnique({ where: { id: u.organisationId }, select: { id: true, name: true, baseCurrency: true } }) : null;
    return { ...user, role: u.role, employeeId: u.employeeId, organisation: org };
  }
}

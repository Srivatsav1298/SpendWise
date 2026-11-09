import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/auth-user';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private prisma: PrismaService) {
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey: config.getOrThrow('JWT_ACCESS_SECRET'), ignoreExpiration: false });
  }

  /** Re-check the DB on every request so deactivation / role changes apply immediately. */
  async validate(payload: { sub: string; org: string | null }): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw new UnauthorizedException();
    if (!payload.org) {
      if (!user.isSuperAdmin) throw new UnauthorizedException();
      return { userId: user.id, email: user.email, organisationId: null, role: null, isSuperAdmin: true, employeeId: null };
    }
    const membership = await this.prisma.organisationMembership.findUnique({
      where: { userId_organisationId: { userId: user.id, organisationId: payload.org } },
      include: { organisation: { select: { status: true } } },
    });
    if (!membership || membership.organisation.status !== 'ACTIVE') throw new UnauthorizedException();
    const employee = await this.prisma.employee.findUnique({ where: { organisationId_userId: { organisationId: payload.org, userId: user.id } } });
    if (employee && !employee.isActive) throw new UnauthorizedException('Employee deactivated');
    return { userId: user.id, email: user.email, organisationId: payload.org, role: membership.role, isSuperAdmin: user.isSuperAdmin, employeeId: employee?.id ?? null };
  }
}

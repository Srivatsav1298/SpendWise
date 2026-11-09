import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { IS_PUBLIC, ROLES_KEY, SUPER_ADMIN_ONLY } from '../decorators';
import { AuthUser } from '../auth-user';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;
    const user: AuthUser = ctx.switchToHttp().getRequest().user;
    if (this.reflector.getAllAndOverride<boolean>(SUPER_ADMIN_ONLY, targets)) {
      if (!user?.isSuperAdmin) throw new ForbiddenException('Super admin only');
      return true;
    }
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, targets);
    if (roles && roles.length) {
      if (!user?.role || !roles.includes(user.role)) throw new ForbiddenException('Insufficient role');
    }
    // Every non-platform route is tenant-scoped: require an organisation context.
    if (!user?.organisationId) throw new ForbiddenException('No organisation context');
    return true;
  }
}

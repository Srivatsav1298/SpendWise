import { Role } from '@prisma/client';

export interface AuthUser {
  userId: string;
  email: string;
  organisationId: string | null;
  role: Role | null;
  isSuperAdmin: boolean;
  employeeId: string | null;
}

/** Roles allowed to see/manage everyone in the org (not just themselves). */
export const MANAGER_ROLES: Role[] = [Role.ORG_ADMIN, Role.FINANCE_MANAGER];
export const isManager = (u: AuthUser) => !!u.role && MANAGER_ROLES.includes(u.role);

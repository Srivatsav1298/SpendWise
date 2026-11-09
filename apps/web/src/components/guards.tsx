import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Role } from '../lib/api';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const loc = useLocation();
  return user ? <>{children}</> : <Navigate to="/login" replace state={{ from: loc.pathname }} />;
}
/** UI convenience only — the API enforces the same roles server-side. */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  return user?.role && roles.includes(user.role) ? <>{children}</> : <Navigate to="/" replace />;
}

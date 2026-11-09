import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { RequireAuth, RequireRole } from './components/guards';
import { AcceptInvite, ForgotPassword, Login, Register, ResetPassword } from './pages/AuthPages';
import Approvals from './pages/Approvals';
import Budgets from './pages/Budgets';
import Cards from './pages/Cards';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Expenses from './pages/Expenses';
import { AuditLog, Notifications, Platform, Settings } from './pages/Misc';
import Reports from './pages/Reports';
import Transactions from './pages/Transactions';
import { useAuth } from './auth/AuthContext';

const MGR = ['ORG_ADMIN', 'FINANCE_MANAGER'] as const;

function Home() {
  const { user } = useAuth();
  return user?.isSuperAdmin && !user.organisationId ? <Navigate to="/platform" replace /> : <Dashboard />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} /><Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} /><Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Home />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="approvals" element={<RequireRole roles={[...MGR]}><Approvals /></RequireRole>} />
        <Route path="cards" element={<Cards />} /><Route path="transactions" element={<Transactions />} />
        <Route path="budgets" element={<RequireRole roles={[...MGR]}><Budgets /></RequireRole>} />
        <Route path="employees" element={<RequireRole roles={[...MGR]}><Employees /></RequireRole>} />
        <Route path="reports" element={<RequireRole roles={[...MGR]}><Reports /></RequireRole>} />
        <Route path="audit" element={<RequireRole roles={[...MGR]}><AuditLog /></RequireRole>} />
        <Route path="notifications" element={<Notifications />} /><Route path="settings" element={<Settings />} />
        <Route path="platform" element={<Platform />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

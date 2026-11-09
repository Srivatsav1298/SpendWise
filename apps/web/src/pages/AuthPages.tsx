import { FormEvent, ReactNode, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api, errorMessage } from '../lib/api';
import { Button, Input } from '../components/ui';

function Shell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <p className="mb-8 text-center text-xl font-semibold tracking-tight text-accent">SpendWise</p>
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <h1 className="text-lg font-semibold">{title}</h1>
          {subtitle && <p className="mb-4 mt-1 text-sm text-muted">{subtitle}</p>}
          {children}
        </div>
        {footer && <p className="mt-4 text-center text-sm text-muted">{footer}</p>}
      </div>
    </div>
  );
}
const homeFor = (u: { isSuperAdmin: boolean; organisationId: string | null }) => (u.isSuperAdmin && !u.organisationId ? '/platform' : '/');
const PW_HINT = 'At least 10 characters with a letter and a digit';
const pwOk = (p: string) => /^(?=.*[A-Za-z])(?=.*\d).{10,128}$/.test(p);

export function Login() {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={from ?? homeFor(user)} replace />;
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(null);
    if (!email.trim() || !password) return setError('Enter your email and password');
    setBusy(true);
    try { await login(email.trim(), password); nav(from ?? '/', { replace: true }); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <Shell title="Sign in" footer={<>New organisation? <Link className="text-accent hover:underline" to="/register">Create an account</Link></>}>
      <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
        <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p role="alert" className="text-sm text-bad">{error}</p>}
        <Button type="submit" className="w-full" loading={busy}>Sign in</Button>
        <p className="text-center text-sm"><Link to="/forgot-password" className="text-accent hover:underline">Forgot password?</Link></p>
      </form>
    </Shell>
  );
}

export function Register() {
  const { register, user } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ organisationName: '', firstName: '', lastName: '', email: '', password: '' });
  const [errs, setErrs] = useState<Record<string, string>>({}); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(null);
    const v: Record<string, string> = {};
    if (f.organisationName.trim().length < 2) v.organisationName = 'Organisation name is required';
    if (!f.firstName.trim()) v.firstName = 'Required'; if (!f.lastName.trim()) v.lastName = 'Required';
    if (!/^\S+@\S+\.\S+$/.test(f.email)) v.email = 'Enter a valid email';
    if (!pwOk(f.password)) v.password = PW_HINT;
    setErrs(v); if (Object.keys(v).length) return;
    setBusy(true);
    try { await register({ ...f, email: f.email.trim() }); nav('/', { replace: true }); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <Shell title="Create your organisation" subtitle="You'll be the organisation admin." footer={<>Have an account? <Link className="text-accent hover:underline" to="/login">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-3" noValidate>
        <Input label="Organisation name" value={f.organisationName} onChange={set('organisationName')} error={errs.organisationName} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" value={f.firstName} onChange={set('firstName')} error={errs.firstName} />
          <Input label="Last name" value={f.lastName} onChange={set('lastName')} error={errs.lastName} />
        </div>
        <Input label="Work email" type="email" autoComplete="email" value={f.email} onChange={set('email')} error={errs.email} />
        <Input label="Password" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} error={errs.password} hint={PW_HINT} />
        {error && <p role="alert" className="text-sm text-bad">{error}</p>}
        <Button type="submit" className="w-full" loading={busy}>Create organisation</Button>
      </form>
    </Shell>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState(''); const [done, setDone] = useState<{ resetToken?: string } | null>(null); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(null); setBusy(true);
    try { setDone((await api.post('/auth/forgot-password', { email: email.trim() }, { auth: false })).data); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <Shell title="Reset your password" footer={<Link className="text-accent hover:underline" to="/login">Back to sign in</Link>}>
      {done ? (
        <div className="mt-3 space-y-3 text-sm">
          <p>If an account exists for that email, a reset link has been issued.</p>
          {done.resetToken && (
            <p className="rounded-lg bg-warn-soft p-3 text-warn">Development mode (no email provider configured): <Link className="font-medium underline" to={`/reset-password?token=${encodeURIComponent(done.resetToken)}`}>continue to reset form</Link></p>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && <p role="alert" className="text-sm text-bad">{error}</p>}
          <Button type="submit" className="w-full" loading={busy} disabled={!email}>Send reset link</Button>
        </form>
      )}
    </Shell>
  );
}

export function ResetPassword() {
  const [sp] = useSearchParams(); const nav = useNavigate();
  const [password, setPassword] = useState(''); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const token = sp.get('token') ?? '';
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(null);
    if (!pwOk(password)) return setErr(PW_HINT);
    setBusy(true);
    try { await api.post('/auth/reset-password', { token, password }, { auth: false }); nav('/login', { replace: true }); } catch (e2) { setErr(errorMessage(e2)); } finally { setBusy(false); }
  };
  return (
    <Shell title="Choose a new password">
      <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
        <Input label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} hint={PW_HINT} />
        {err && <p role="alert" className="text-sm text-bad">{err}</p>}
        <Button type="submit" className="w-full" loading={busy} disabled={!token}>Update password</Button>
        {!token && <p className="text-sm text-bad">This link is missing its token.</p>}
      </form>
    </Shell>
  );
}

export function AcceptInvite() {
  const [sp] = useSearchParams(); const nav = useNavigate(); const { acceptInvite } = useAuth();
  const [f, setF] = useState({ firstName: '', lastName: '', password: '' }); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const token = sp.get('token') ?? '';
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(null);
    if (!f.firstName.trim() || !f.lastName.trim()) return setErr('Enter your name');
    if (!pwOk(f.password)) return setErr(PW_HINT);
    setBusy(true);
    try { await acceptInvite({ token, ...f }); nav('/', { replace: true }); } catch (e2) { setErr(errorMessage(e2)); } finally { setBusy(false); }
  };
  return (
    <Shell title="Join your organisation" subtitle="Set up your account to accept the invitation.">
      <form onSubmit={submit} className="space-y-3" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} />
          <Input label="Last name" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} />
        </div>
        <Input label="Password" type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} hint={PW_HINT} />
        {err && <p role="alert" className="text-sm text-bad">{err}</p>}
        <Button type="submit" className="w-full" loading={busy} disabled={!token}>Accept invitation</Button>
      </form>
    </Shell>
  );
}

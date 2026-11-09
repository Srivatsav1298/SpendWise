import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, Card, Empty, ErrorState, Input, PageHeader, Pagination, Spinner, Table, Td, Th } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { dateTime, ROLE_LABEL } from '../lib/format';

export function Notifications() {
  const qc = useQueryClient(); const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['notifications', page], queryFn: () => api.get('/notifications', { page, pageSize: 20 }) });
  const reload = () => qc.invalidateQueries({ queryKey: ['notifications'] });
  return (
    <>
      <PageHeader title="Notifications" action={<Button variant="secondary" onClick={async () => { await api.post('/notifications/read-all'); reload(); }}>Mark all read</Button>} />
      <Card>
        {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.data.data.length === 0 ? <Empty title="Nothing here" hint="Approvals, budget alerts and card flags will appear here." /> : (<>
          <ul className="divide-y divide-line">{q.data.data.map((n: any) => (
            <li key={n.id} className="flex items-start justify-between gap-3 py-3">
              <div><p className={n.readAt ? 'text-muted' : 'font-medium'}>{!n.readAt && <span aria-label="unread" className="mr-2 inline-block h-2 w-2 rounded-full bg-accent" />}{n.title}</p><p className="text-sm text-muted">{n.body}</p><p className="mt-1 text-xs text-muted">{dateTime(n.createdAt)}</p></div>
              {!n.readAt && <Button variant="ghost" onClick={async () => { await api.patch(`/notifications/${n.id}/read`, {}); reload(); }}>Mark read</Button>}
            </li>))}</ul>
          <Pagination meta={q.data.meta} onPage={setPage} /></>)}
      </Card>
    </>
  );
}

export function Settings() {
  const { user } = useAuth();
  const org = useQuery({ queryKey: ['org'], queryFn: () => api.get('/organisations/current').then((r) => r.data) });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' }); const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [name, setName] = useState({ firstName: user?.firstName ?? '', lastName: user?.lastName ?? '' }); const [nameMsg, setNameMsg] = useState<string | null>(null);
  const [thr, setThr] = useState<string | null>(null); const [orgMsg, setOrgMsg] = useState<string | null>(null);
  const changePw = async (e: FormEvent) => {
    e.preventDefault(); setPwMsg(null);
    if (!/^(?=.*[A-Za-z])(?=.*\d).{10,128}$/.test(pw.newPassword)) return setPwMsg({ ok: false, text: 'New password needs 10+ characters with a letter and a digit' });
    try { await api.post('/users/me/password', pw); setPwMsg({ ok: true, text: 'Password changed. Other sessions were signed out.' }); setPw({ currentPassword: '', newPassword: '' }); } catch (x) { setPwMsg({ ok: false, text: errorMessage(x) }); }
  };
  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Profile">
          <p className="mb-3 text-sm text-muted">{user?.email} · {user?.role ? ROLE_LABEL[user.role] : 'Super admin'}</p>
          <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); try { await api.patch('/users/me', name); setNameMsg('Saved'); } catch (x) { setNameMsg(errorMessage(x)); } }}>
            <div className="grid grid-cols-2 gap-3"><Input label="First name" value={name.firstName} onChange={(e) => setName({ ...name, firstName: e.target.value })} /><Input label="Last name" value={name.lastName} onChange={(e) => setName({ ...name, lastName: e.target.value })} /></div>
            <div className="flex items-center gap-3"><Button type="submit" variant="secondary">Save profile</Button>{nameMsg && <span role="status" className="text-sm text-muted">{nameMsg}</span>}</div>
          </form>
        </Card>
        <Card title="Change password">
          <form className="space-y-3" onSubmit={changePw} noValidate>
            <Input label="Current password" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
            <Input label="New password" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} hint="At least 10 characters with a letter and a digit" />
            {pwMsg && <p role={pwMsg.ok ? 'status' : 'alert'} className={`text-sm ${pwMsg.ok ? 'text-ok' : 'text-bad'}`}>{pwMsg.text}</p>}
            <Button type="submit" variant="secondary">Update password</Button>
          </form>
        </Card>
        {org.data && (
          <Card title="Organisation" className="lg:col-span-2">
            <p className="text-sm text-muted">{org.data.name} · base currency {org.data.baseCurrency}</p>
            {user?.role === 'ORG_ADMIN' ? (
              <form className="mt-3 flex items-end gap-3" onSubmit={async (e) => { e.preventDefault(); try { await api.patch('/organisations/current', { requireReceiptOver: thr ?? org.data.requireReceiptOver }); setOrgMsg('Saved'); } catch (x) { setOrgMsg(errorMessage(x)); } }}>
                <div className="w-64"><Input label="Require receipt for expenses at or above" inputMode="decimal" value={thr ?? org.data.requireReceiptOver} onChange={(e) => setThr(e.target.value)} /></div>
                <Button type="submit" variant="secondary">Save</Button>{orgMsg && <span role="status" className="text-sm text-muted">{orgMsg}</span>}
              </form>
            ) : <p className="mt-2 text-sm text-muted">Receipts are required at or above {org.data.requireReceiptOver} {org.data.baseCurrency}.</p>}
          </Card>
        )}
      </div>
    </>
  );
}

export function AuditLog() {
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['audit', page], queryFn: () => api.get('/audit-logs', { page, pageSize: 25 }) });
  return (
    <>
      <PageHeader title="Audit log" subtitle="Immutable record of financial and administrative actions" />
      <Card>
        {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.data.data.length === 0 ? <Empty title="No activity yet" /> : (<>
          <Table><thead><tr><Th>When</Th><Th>Action</Th><Th>Entity</Th><Th>Details</Th></tr></thead><tbody>{q.data.data.map((l: any) => (
            <tr key={l.id}><Td>{dateTime(l.createdAt)}</Td><Td><Badge value="DRAFT" label={l.action} /></Td><Td className="text-xs text-muted">{l.entityType}</Td><Td className="max-w-md truncate text-xs text-muted">{l.metadata ? JSON.stringify(l.metadata) : ''}</Td></tr>))}</tbody></Table>
          <Pagination meta={q.data.meta} onPage={setPage} /></>)}
      </Card>
    </>
  );
}

export function Platform() {
  const qc = useQueryClient(); const [page, setPage] = useState(1); const [err, setErr] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['platform', page], queryFn: () => api.get('/platform/organisations', { page, pageSize: 20 }) });
  const set = async (id: string, status: string) => { setErr(null); try { await api.patch(`/platform/organisations/${id}/status`, { status }); qc.invalidateQueries({ queryKey: ['platform'] }); } catch (e) { setErr(errorMessage(e)); } };
  return (
    <>
      <PageHeader title="Organisations" subtitle="Platform administration" />
      {err && <p role="alert" className="mb-3 text-sm text-bad">{err}</p>}
      <Card>
        {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (<>
          <Table><thead><tr><Th>Organisation</Th><Th>Currency</Th><Th right>Members</Th><Th right>Expenses</Th><Th>Status</Th><Th /></tr></thead><tbody>{q.data.data.map((o: any) => (
            <tr key={o.id}><Td className="font-medium">{o.name}<span className="block text-xs text-muted">{o.slug}</span></Td><Td>{o.baseCurrency}</Td><Td right>{o._count.memberships}</Td><Td right>{o._count.expenses}</Td><Td><Badge value={o.status} /></Td>
              <Td right><Button variant="ghost" onClick={() => set(o.id, o.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')}>{o.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}</Button></Td></tr>))}</tbody></Table>
          <Pagination meta={q.data.meta} onPage={setPage} /></>)}
      </Card>
    </>
  );
}

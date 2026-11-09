import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, Card, Empty, ErrorState, Input, Modal, PageHeader, Pagination, Select, Spinner, Table, Td, Th } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { AMOUNT_RE, ROLE_LABEL, date, money } from '../lib/format';
import { ExpenseDetail } from '../components/ExpenseDetail';

const ROLES = ['EMPLOYEE', 'FINANCE_MANAGER', 'ORG_ADMIN'];

function InviteModal({ departments, onClose, onDone }: { departments: any[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ email: '', role: 'EMPLOYEE', departmentId: '', monthlyLimit: '' });
  const [err, setErr] = useState<string | null>(null); const [token, setToken] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(null);
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return setErr('Enter a valid email');
    if (f.monthlyLimit && !AMOUNT_RE.test(f.monthlyLimit)) return setErr('Monthly limit must be a decimal amount');
    setBusy(true);
    try {
      const r = await api.post('/employees/invite', { email: f.email.trim(), role: f.role, departmentId: f.departmentId || undefined, monthlyLimit: f.monthlyLimit || undefined });
      setToken(r.data.inviteToken ?? ''); onDone();
    } catch (e2) { setErr(errorMessage(e2)); } finally { setBusy(false); }
  };
  return (
    <Modal title="Invite employee" onClose={onClose}>
      {token !== null ? (
        <div className="space-y-3 text-sm">
          <p>Invitation created for <b>{f.email}</b>.</p>
          {token ? <p className="break-all rounded-lg bg-warn-soft p-3 text-warn">No email provider is configured. Share this link manually:<br /><code>{`${location.origin}/accept-invite?token=${token}`}</code></p> : <p>The invitation link has been issued.</p>}
          <div className="flex justify-end"><Button onClick={onClose}>Done</Button></div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3" noValidate>
          <Input label="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <Select label="Role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select>
          <Select label="Department" value={f.departmentId} onChange={(e) => setF({ ...f, departmentId: e.target.value })}><option value="">None</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
          <Input label="Monthly spending limit (optional)" inputMode="decimal" value={f.monthlyLimit} onChange={(e) => setF({ ...f, monthlyLimit: e.target.value })} />
          {err && <p role="alert" className="text-sm text-bad">{err}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Send invitation</Button></div>
        </form>
      )}
    </Modal>
  );
}

function EditModal({ emp, departments, isAdmin, currency, onClose, onDone }: { emp: any; departments: any[]; isAdmin: boolean; currency: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ role: emp.role, departmentId: emp.department?.id ?? '', jobTitle: emp.jobTitle ?? '', monthlyLimit: emp.monthlyLimit ?? '' });
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const hist = useQuery({ queryKey: ['expenses', 'emp', emp.id], queryFn: () => api.get('/expenses', { employeeId: emp.id, pageSize: 8 }) });
  const [openId, setOpenId] = useState<string | null>(null);
  const save = async () => {
    setErr(null);
    if (f.monthlyLimit && !AMOUNT_RE.test(String(f.monthlyLimit))) return setErr('Monthly limit must be a decimal amount');
    setBusy(true);
    try { await api.patch(`/employees/${emp.id}`, { role: f.role, departmentId: f.departmentId || null, jobTitle: f.jobTitle, monthlyLimit: f.monthlyLimit || null }); onDone(); onClose(); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Modal title={`${emp.firstName} ${emp.lastName}`} onClose={onClose} wide>
      <p className="mb-4 text-sm text-muted">{emp.email}</p>
      {isAdmin && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select>
          <Select label="Department" value={f.departmentId} onChange={(e) => setF({ ...f, departmentId: e.target.value })}><option value="">None</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
          <Input label="Job title" value={f.jobTitle} onChange={(e) => setF({ ...f, jobTitle: e.target.value })} />
          <Input label={`Monthly limit (${currency})`} inputMode="decimal" value={f.monthlyLimit} onChange={(e) => setF({ ...f, monthlyLimit: e.target.value })} hint="Leave empty for no limit" />
        </div>
      )}
      {err && <p role="alert" className="mt-3 text-sm text-bad">{err}</p>}
      {isAdmin && <div className="mt-4 flex justify-end"><Button loading={busy} onClick={save}>Save changes</Button></div>}
      <h3 className="mb-2 mt-6 text-sm font-semibold">Recent expenses</h3>
      {hist.isLoading ? <Spinner /> : hist.data?.data.length ? (
        <Table><thead><tr><Th>Date</Th><Th>Merchant</Th><Th>Status</Th><Th right>Amount</Th></tr></thead><tbody>{hist.data.data.map((x: any) => (
          <tr key={x.id} className="cursor-pointer hover:bg-bg" onClick={() => setOpenId(x.id)}><Td>{date(x.expenseDate)}</Td><Td>{x.merchant}</Td><Td><Badge value={x.status} /></Td><Td right>{money(x.amount, x.currency)}</Td></tr>))}</tbody></Table>
      ) : <p className="text-sm text-muted">No expenses yet.</p>}
      {openId && <ExpenseDetail id={openId} onClose={() => setOpenId(null)} />}
    </Modal>
  );
}

export default function Employees() {
  const { user, currency } = useAuth();
  const isAdmin = user?.role === 'ORG_ADMIN';
  const qc = useQueryClient();
  const [f, setF] = useState({ search: '', departmentId: '', role: '', active: '' }); const [page, setPage] = useState(1);
  const [invite, setInvite] = useState(false); const [edit, setEdit] = useState<any | null>(null); const [rowErr, setRowErr] = useState<string | null>(null);
  const deps = useQuery({ queryKey: ['departments'], queryFn: () => api.get('/departments').then((r) => r.data) });
  const q = useQuery({ queryKey: ['employees', f, page], queryFn: () => api.get('/employees', { ...f, page, pageSize: 15 }), placeholderData: (p) => p });
  const invs = useQuery({ queryKey: ['invitations'], queryFn: () => api.get('/employees/invitations').then((r) => r.data), enabled: isAdmin });
  const reload = () => { qc.invalidateQueries({ queryKey: ['employees'] }); qc.invalidateQueries({ queryKey: ['invitations'] }); qc.invalidateQueries({ queryKey: ['departments'] }); };
  const toggle = async (e: any) => { setRowErr(null); try { await api.post(`/employees/${e.id}/${e.isActive ? 'deactivate' : 'activate'}`); reload(); } catch (x) { setRowErr(errorMessage(x)); } };
  const upd = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setF({ ...f, [k]: e.target.value }); setPage(1); };
  const [newDept, setNewDept] = useState('');
  const addDept = async () => { if (newDept.trim().length < 2) return; try { await api.post('/departments', { name: newDept.trim() }); setNewDept(''); reload(); } catch (x) { setRowErr(errorMessage(x)); } };

  return (
    <>
      <PageHeader title="People" subtitle="Employees, roles, departments and spending limits" action={isAdmin ? <Button onClick={() => setInvite(true)}>Invite employee</Button> : undefined} />
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="Search" placeholder="Name or email" value={f.search} onChange={upd('search')} />
          <Select label="Department" value={f.departmentId} onChange={upd('departmentId')}><option value="">All</option>{deps.data?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
          <Select label="Role" value={f.role} onChange={upd('role')}><option value="">All</option>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select>
          <Select label="Status" value={f.active} onChange={upd('active')}><option value="">All</option><option value="true">Active</option><option value="false">Deactivated</option></Select>
        </div>
      </Card>
      {rowErr && <p role="alert" className="mb-3 rounded-lg bg-bad-soft p-3 text-sm text-bad">{rowErr}</p>}
      <Card>
        {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.data.data.length === 0 ? <Empty title="No people match" /> : (
          <>
            <Table><thead><tr><Th>Name</Th><Th>Role</Th><Th>Department</Th><Th right>Monthly limit</Th><Th>Status</Th><Th /></tr></thead>
              <tbody>{q.data.data.map((e: any) => (
                <tr key={e.id}>
                  <Td><button className="text-left font-medium hover:underline" onClick={() => setEdit(e)}>{e.firstName} {e.lastName}</button><span className="block text-xs text-muted">{e.email}</span></Td>
                  <Td>{ROLE_LABEL[e.role]}</Td><Td>{e.department?.name ?? '—'}</Td><Td right>{e.monthlyLimit ? money(e.monthlyLimit, currency) : 'No limit'}</Td>
                  <Td><Badge value={e.isActive ? 'ACTIVE' : 'INACTIVE'} label={e.isActive ? 'Active' : 'Deactivated'} /></Td>
                  <Td right>{isAdmin && e.userId !== user?.id && <Button variant="ghost" onClick={() => toggle(e)}>{e.isActive ? 'Deactivate' : 'Reactivate'}</Button>}</Td>
                </tr>))}</tbody></Table>
            <Pagination meta={q.data.meta} onPage={setPage} />
          </>
        )}
      </Card>
      {isAdmin && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card title="Departments">
            <ul className="mb-3 space-y-1 text-sm">{deps.data?.map((d: any) => <li key={d.id} className="flex justify-between"><span>{d.name}</span><span className="text-muted">{d._count.employees} people</span></li>)}</ul>
            <div className="flex gap-2"><div className="flex-1"><Input label="New department" value={newDept} onChange={(e) => setNewDept(e.target.value)} /></div><Button className="self-end" variant="secondary" onClick={addDept}>Add</Button></div>
          </Card>
          <Card title="Pending invitations">
            {invs.data?.length ? <ul className="space-y-1 text-sm">{invs.data.map((i: any) => <li key={i.id} className="flex justify-between"><span>{i.email}</span><span className="text-muted">{ROLE_LABEL[i.role]} · expires {date(i.expiresAt)}</span></li>)}</ul> : <p className="text-sm text-muted">No pending invitations.</p>}
          </Card>
        </div>
      )}
      {invite && <InviteModal departments={deps.data ?? []} onClose={() => setInvite(false)} onDone={reload} />}
      {edit && <EditModal emp={edit} departments={deps.data ?? []} isAdmin={isAdmin} currency={currency} onClose={() => setEdit(null)} onDone={reload} />}
    </>
  );
}

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ExpenseDetail } from '../components/ExpenseDetail';
import { ExpenseForm } from '../components/ExpenseForm';
import { Badge, Button, Card, Empty, ErrorState, Input, Modal, PageHeader, Pagination, Select, Spinner, Table, Td, Th } from '../components/ui';
import { api } from '../lib/api';
import { CATEGORIES, date, money } from '../lib/format';

const STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REIMBURSED'];

export default function Expenses() {
  const { currency, isManager } = useAuth();
  const qc = useQueryClient();
  const [f, setF] = useState({ status: '', category: '', employeeId: '', from: '', to: '', search: '' });
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false); const [openId, setOpenId] = useState<string | null>(null);
  const emps = useQuery({ queryKey: ['employees', 'all'], queryFn: () => api.get('/employees', { pageSize: 100 }), enabled: isManager });
  const q = useQuery({ queryKey: ['expenses', f, page], queryFn: () => api.get('/expenses', { ...f, page, pageSize: 15 }), placeholderData: (p) => p });
  const upd = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setF({ ...f, [k]: e.target.value }); setPage(1); };

  return (
    <>
      <PageHeader title="Expenses" subtitle={isManager ? 'All expenses in your organisation' : 'Your expense submissions'} action={<Button onClick={() => setCreating(true)}>New expense</Button>} />
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Input label="Search" placeholder="Merchant or note" value={f.search} onChange={upd('search')} />
          <Select label="Status" value={f.status} onChange={upd('status')}><option value="">All</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</Select>
          <Select label="Category" value={f.category} onChange={upd('category')}><option value="">All</option>{CATEGORIES.map((s) => <option key={s}>{s}</option>)}</Select>
          {isManager && <Select label="Employee" value={f.employeeId} onChange={upd('employeeId')}><option value="">Everyone</option>{emps.data?.data.map((e: any) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}</Select>}
          <Input label="From" type="date" value={f.from} onChange={upd('from')} /><Input label="To" type="date" value={f.to} onChange={upd('to')} />
        </div>
      </Card>
      <Card>
        {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.data.data.length === 0 ? (
          <Empty title="No expenses found" hint="Adjust the filters, or submit your first expense." action={<Button onClick={() => setCreating(true)}>New expense</Button>} />
        ) : (
          <>
            <Table><thead><tr><Th>Date</Th><Th>Merchant</Th>{isManager && <Th>Employee</Th>}<Th>Category</Th><Th>Status</Th><Th right>Amount</Th></tr></thead>
              <tbody>{q.data.data.map((x: any) => (
                <tr key={x.id} onClick={() => setOpenId(x.id)} className="cursor-pointer hover:bg-bg">
                  <Td>{date(x.expenseDate)}</Td>
                  <Td><button className="text-left font-medium text-ink hover:underline" onClick={() => setOpenId(x.id)}>{x.merchant}</button></Td>
                  {isManager && <Td>{x.employee.name}</Td>}<Td>{x.category}</Td><Td><Badge value={x.status} /></Td><Td right>{money(x.amount, x.currency)}</Td>
                </tr>))}</tbody></Table>
            <Pagination meta={q.data.meta} onPage={setPage} />
          </>
        )}
      </Card>
      {creating && <Modal title="New expense" onClose={() => setCreating(false)} wide><ExpenseForm currency={currency} onDone={() => { setCreating(false); qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); }} /></Modal>}
      {openId && <ExpenseDetail id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ApprovalActions } from '../components/ApprovalActions';
import { ExpenseDetail } from '../components/ExpenseDetail';
import { Card, Empty, ErrorState, PageHeader, Pagination, Spinner, Table, Td, Th } from '../components/ui';
import { api } from '../lib/api';
import { date, money } from '../lib/format';

export default function Approvals() {
  const { currency } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1); const [openId, setOpenId] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['approvals', page], queryFn: () => api.get('/approvals/pending', { page, pageSize: 15 }) });
  const done = () => { qc.invalidateQueries({ queryKey: ['approvals'] }); qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['budgets'] }); };
  return (
    <>
      <PageHeader title="Approvals" subtitle="Expenses waiting for a decision. You cannot decide your own expenses." />
      <Card>
        {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.data.data.length === 0 ? <Empty title="You're all caught up" hint="No expenses are waiting for approval." /> : (
          <>
            <Table><thead><tr><Th>Submitted</Th><Th>Employee</Th><Th>Merchant</Th><Th>Receipts</Th><Th right>Amount</Th><Th /></tr></thead>
              <tbody>{q.data.data.map((x: any) => (
                <tr key={x.id}>
                  <Td>{date(x.submittedAt ?? x.createdAt)}</Td><Td>{x.employee.name}<span className="block text-xs text-muted">{x.employee.department ?? '—'}</span></Td>
                  <Td><button className="text-left font-medium hover:underline" onClick={() => setOpenId(x.id)}>{x.merchant}</button><span className="block text-xs text-muted">{x.category}</span></Td>
                  <Td>{x.receipts.length}</Td><Td right>{money(x.amount, x.currency || currency)}</Td>
                  <Td className="min-w-[190px]"><ApprovalActions expenseId={x.id} onDone={done} /></Td>
                </tr>))}</tbody></Table>
            <Pagination meta={q.data.meta} onPage={setPage} />
          </>
        )}
      </Card>
      {openId && <ExpenseDetail id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}

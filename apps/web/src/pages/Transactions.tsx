import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Badge, Card, Empty, ErrorState, Input, PageHeader, Pagination, Select, Spinner, Table, Td, Th } from '../components/ui';
import { api } from '../lib/api';
import { dateTime, money } from '../lib/format';

export default function Transactions() {
  const { currency, isManager } = useAuth();
  const [f, setF] = useState({ status: '', flagged: '', from: '', to: '' }); const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['transactions', f, page], queryFn: () => api.get('/transactions', { ...f, page, pageSize: 20 }), placeholderData: (p) => p });
  const upd = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setF({ ...f, [k]: e.target.value }); setPage(1); };
  return (
    <>
      <PageHeader title="Transactions" subtitle={isManager ? 'Simulated card activity across the organisation' : 'Your simulated card activity'} />
      <Card className="mb-4"><div className="grid gap-3 sm:grid-cols-4">
        <Select label="Status" value={f.status} onChange={upd('status')}><option value="">All</option><option>APPROVED</option><option>DECLINED</option></Select>
        <Select label="Flags" value={f.flagged} onChange={upd('flagged')}><option value="">All</option><option value="true">Flagged only</option></Select>
        <Input label="From" type="date" value={f.from} onChange={upd('from')} /><Input label="To" type="date" value={f.to} onChange={upd('to')} />
      </div></Card>
      <Card>
        {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.data.data.length === 0 ? <Empty title="No transactions" /> : (<>
          <Table><thead><tr><Th>When</Th><Th>Merchant</Th><Th>Category</Th><Th>Status</Th><Th>Notes</Th><Th right>Amount</Th></tr></thead>
            <tbody>{q.data.data.map((t: any) => (
              <tr key={t.id}><Td>{dateTime(t.occurredAt)}</Td><Td className="font-medium">{t.merchant}</Td><Td>{t.category}</Td>
                <Td><Badge value={t.status} />{t.flagged && <span className="ml-1"><Badge value="FLAGGED" /></span>}</Td>
                <Td className="max-w-xs text-xs text-muted">{t.declineReason ?? t.flagReason ?? ''}</Td><Td right>{money(t.amount, t.currency || currency)}</Td></tr>))}</tbody></Table>
          <Pagination meta={q.data.meta} onPage={setPage} /></>)}
      </Card>
    </>
  );
}

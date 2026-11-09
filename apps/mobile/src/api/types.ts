import type { MoneyString } from '../lib/money';

export type ExpenseStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REIMBURSED';
export type TxStatus = 'APPROVED' | 'DECLINED';
export type CardStatus = 'ACTIVE' | 'FROZEN' | 'CANCELLED' | string;
export type Role = 'EMPLOYEE' | 'MANAGER' | 'FINANCE_MANAGER' | 'ORG_ADMIN' | string;

export interface Tokens { accessToken: string; refreshToken: string }

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
}

export interface AuthResult extends Tokens { user: SessionUser }

export interface Me {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  employeeId: string | null;
  organisation: { id: string; name: string; baseCurrency: string };
}

export interface PageMeta { page: number; pageSize: number; total: number; totalPages: number; unread?: number }
export interface Paged<T> { data: T[]; meta: PageMeta }

export interface Receipt { id: string; originalName: string; mimeType: string; sizeBytes: number; createdAt: string }
export interface ApprovalEntry { id: string; approverId: string; decision: string; comment: string | null; createdAt: string }

export interface Expense {
  id: string;
  amount: MoneyString;
  currency: string;
  expenseDate: string;
  category: string;
  merchant: string;
  description: string | null;
  status: ExpenseStatus;
  submittedAt: string | null;
  createdAt: string;
  receipts: Receipt[];
  approvals: ApprovalEntry[];
}

export interface Transaction {
  id: string;
  cardId: string;
  amount: MoneyString;
  currency: string;
  merchant: string;
  category: string;
  status: TxStatus;
  declineReason: string | null;
  flagged: boolean;
  flagReason: string | null;
  occurredAt: string;
  simulated?: boolean;
}

export interface Card {
  id: string;
  simulated: boolean;
  label: string | null;
  maskedNumber: string;
  last4: string;
  status: CardStatus;
  currency: string;
  dailyLimit: MoneyString;
  monthlyLimit: MoneyString;
  blockedCategories: string[];
  spentThisMonth: MoneyString;
}

export interface Limits {
  monthlyLimit: MoneyString | null;
  spentThisMonth: MoneyString;
  remaining: MoneyString | null;
  cards: { id: string; label: string | null; last4: string; status: CardStatus; dailyLimit: MoneyString; monthlyLimit: MoneyString }[];
}

export interface DashboardTx {
  id: string; merchant: string; category: string; amount: MoneyString; status: TxStatus; flagged: boolean; occurredAt: string;
}
export interface Dashboard {
  totalSpend: MoneyString;
  monthSpend: MoneyString;
  pendingApprovals: { count: number; amount: MoneyString };
  recentTransactions: DashboardTx[];
  monthlyTrend: { key: string; total: MoneyString; count: number }[];
  byCategory: { key: string; total: MoneyString; count: number }[];
}

export interface AppNotification {
  id: string; title: string; body: string; readAt: string | null; createdAt: string;
}

export interface Profile { id: string; email: string; firstName: string; lastName: string }

export interface ApiErrorBody {
  statusCode: number; error: string; message: string | string[]; path?: string; timestamp?: string;
}

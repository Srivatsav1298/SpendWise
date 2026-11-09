# SpendWise — Technical Implementation Plan

## Layout (npm workspaces monorepo)
```
apps/api      NestJS 11 + Prisma 6 + PostgreSQL (REST, Swagger at /api/docs)
apps/web      React 18 + Vite + TS + Tailwind + Recharts
apps/mobile   Expo + React Native + TS (employee app)
docs/         PLAN.md, DEPLOYMENT.md
docker-compose.yml (postgres:16 on host port 5433, api, web)
.github/workflows/ci.yml
```

## Decisions (my calls, not agreed with the user)
- Prisma 6 (stable, classic datasource config); Argon2id for passwords.
- Money: Prisma `Decimal(14,2)`; arithmetic via `Prisma.Decimal` (decimal.js), never JS numbers. Amounts travel as strings in the API.
- Multi-tenancy: every tenant table carries `organisationId`; services always filter by the caller's org taken from the JWT, never from the request body. Integration tests assert cross-org access returns 404.
- Roles live on `OrganisationMembership` (SUPER_ADMIN is a flag on `User`). One active org per login token.
- Tokens: 15 min access JWT; refresh token is an opaque random value, stored hashed, rotated on use; reuse of a rotated token revokes the whole family.
- Uploads: local disk (`UPLOAD_DIR`), MIME sniffing by magic bytes, 5 MB cap, served only via authenticated endpoint with org/owner checks.
- Notifications: in-app (DB) only; no email provider. Password-reset and invite tokens are returned in the API response in non-production and logged-as-masked otherwise (no SMTP) — a known limitation.
- Cards: simulated only; store last4 + masked label, no PAN/CVV. Labelled SIMULATED everywhere.
- Idempotency: `Idempotency-Key` header on card transaction simulation, unique per card.
- Budget enforcement: card transactions beyond card limits/category rules/budget are DECLINED (and flagged); expenses submission is blocked if it exceeds the employee's monthly limit remaining, and approval re-checks department budget inside a DB transaction.
- Alerts at 75/90/100% recorded once per budget-period via `BudgetAlert` unique key (stored as Notifications; tracked in a `thresholdsNotified` int array on Budget).

## Data model
User, Organisation, OrganisationMembership, Department, Employee, Expense, ExpenseReceipt, Approval, CorporateCard, Transaction, Budget, SpendingPolicy, Notification, AuditLog, RefreshToken, PasswordReset, Invitation.

## Backend modules
Auth, Users, Organisations, Employees, Departments, Expenses, Approvals, Cards, Transactions, Budgets, Notifications, Reports, Uploads, AuditLogs (+ Common: guards, decorators, filters, interceptors, money helpers; Prisma).

## Order of work
1. Scaffold monorepo, Docker Compose DB, Prisma schema + migration.
2. Auth/RBAC/tenancy core + tests.
3. Domain modules + tests (expenses, approvals, budgets, cards/transactions, reports).
4. Seed data + demo accounts.
5. Web app (auth, dashboard, employees, expenses, approvals, cards, budgets, reports) + tests.
6. Mobile app.
7. CI, Dockerfiles, docs; end-to-end verification against real DB.

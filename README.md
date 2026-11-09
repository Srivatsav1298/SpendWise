# SpendWise

Multi-tenant corporate spend & expense management: employees, departments, expenses with receipts, approval
workflows, **simulated** virtual cards, budgets with backend-enforced limits and threshold alerts, reporting and CSV export.

| App | Stack | Path |
|---|---|---|
| API | NestJS 11 · Prisma 6 · PostgreSQL 16 · JWT · Swagger | `apps/api` |
| Web | React 18 · Vite · TypeScript · Tailwind · React Query · Recharts | `apps/web` |
| Mobile (employee) | Expo · React Native · TypeScript | `apps/mobile` (own `node_modules`, see its README) |

> Cards are **simulated**. No real payment network is contacted and no PAN/CVV/expiry is stored (only a random last-4).

## Run locally

Prerequisites: Node 22+ (tested on 26), Docker.

```bash
# 1. Postgres (host port 5433 so it won't clash with a local Postgres on 5432)
docker compose up -d db

# 2. Install (workspaces: api + web). npm 11 blocks install scripts by default; approve the ones the API needs once:
npm install
npm approve-scripts @prisma/client prisma @prisma/engines argon2   # only needed on npm >= 11.x

# 3. API
cp apps/api/.env.example apps/api/.env
npm run migrate:deploy -w apps/api
npm run seed -w apps/api            # demo data
npm run start:dev -w apps/api       # http://localhost:3000/api  ·  Swagger: http://localhost:3000/api/docs

# 4. Web (new terminal)
cp apps/web/.env.example apps/web/.env
npm run dev -w apps/web             # http://localhost:5173
```

Or everything in containers (API + DB + web on :8080):

```bash
docker compose up --build -d
docker compose exec api npm run seed
```

### Demo accounts (all use password `Spendwise123!` — demo data only)

| Role | Email |
|---|---|
| Super admin | `superadmin@spendwise.demo` |
| Organisation admin | `admin@spendwise.demo` |
| Finance manager | `finance@spendwise.demo` |
| Employee | `employee@spendwise.demo` (also `lars@`, `nora@`, `erik@spendwise.demo`) |

Seeded org "Fjord Technologies AS" (NOK) has ~70 historical approved expenses, 4 simulated cards with transactions,
department budgets (Sales sits at ~89% so the 90% alert fires on the next approval), 3 pending approvals, a rejected expense,
a declined+flagged card transaction and two spending policies. Re-running the seed resets that organisation.

## Tests

```bash
npm run test:unit -w apps/api   # pure rules + auth service (no DB)
npm run test:e2e  -w apps/api   # real Postgres: needs the db container and a `spendwise_test` database (see below)
npm test -w apps/web            # Vitest + React Testing Library
```

Integration tests run against a separate database and apply the real migrations first:

```bash
docker compose exec -T db psql -U spendwise -c "CREATE DATABASE spendwise_test"
```

## Architecture

```
React web ─┐                          ┌─ Auth / RBAC / tenancy guards (global)
Expo app  ─┼─ REST /api (JSON) ─► NestJS ─┼─ Domain services (expenses, approvals, budgets, cards, transactions, reports…)
Swagger   ─┘                          └─ Prisma ─► PostgreSQL (Decimal(14,2) money, explicit currency, indexed, FK-enforced)
```

* **Modules**: Auth, Users, Organisations, Employees, Departments, Expenses, Approvals, Cards, Transactions, Budgets,
  Notifications, Reports, Uploads, AuditLogs (+ Prisma, common guards/filters/interceptors).
* **Response shape**: `{ data, meta? }`; errors `{ statusCode, error, message, path, timestamp }`. Money is always a decimal **string**.
* **Tenancy**: every tenant table has `organisationId`; the org always comes from the verified JWT + a DB membership re-check on each request,
  never from the request body. Cross-org access returns **404** (no existence leak). Isolation is application-level (no Postgres RLS).
* **Roles** (`OrganisationMembership.role`): `ORG_ADMIN`, `FINANCE_MANAGER`, `EMPLOYEE`; `User.isSuperAdmin` for platform admins.
  Enforced by `RolesGuard` on the backend; the web UI hides things only as a convenience.
* **Money**: `Prisma.Decimal` (decimal.js) everywhere; SQL aggregates are cast to text. No floats in monetary math.
* **Spend definition**: approved/reimbursed expenses (by expense date) + approved card transactions. Pending, rejected and declined never count.
* **Budget enforcement** (`BudgetGuardService.reserve`): runs inside the DB transaction that approves an expense or records a card transaction,
  takes `SELECT … FOR UPDATE` on the applicable budget rows, blocks anything that would exceed the cap (exactly 100% is allowed), and records 75/90/100% alerts once each.
* **Card simulation**: card row locked per swipe so concurrent swipes can't jointly breach daily/monthly limits; `Idempotency-Key` header makes retries safe.
* **Auth**: Argon2id; 15-min JWT access token; opaque refresh tokens stored as SHA-256 hashes, single-use with rotation, family revocation on reuse;
  password reset revokes all sessions. Deactivated users/employees and suspended orgs lose access on the next request.
* **Uploads**: ≤5 MB, JPEG/PNG/WebP/PDF verified by magic bytes (client MIME ignored), random server-side names, served only through an authenticated, tenant-checked endpoint with `nosniff` + sandbox CSP.
* **Hardening**: Helmet, CORS allow-list, global validation (`whitelist` + `forbidNonWhitelisted`), rate limiting (stricter on auth), CSV formula-injection guard, no secrets/bodies in logs, audit log written in the same transaction as financial changes.

## API overview (`/api`, full detail in Swagger)

| Area | Endpoints |
|---|---|
| Auth | `POST auth/register · login · refresh · logout · forgot-password · reset-password · accept-invite` · `GET auth/me` |
| Users | `GET/PATCH users/me` · `POST users/me/password` |
| Organisation | `GET/PATCH organisations/current` · `GET platform/organisations` · `PATCH platform/organisations/:id/status` (super admin) |
| Employees | `GET employees` (search/filter/paginate) · `GET employees/me · me/limits · invitations · :id` · `POST employees/invite` · `PATCH employees/:id` · `POST employees/:id/activate · deactivate` |
| Departments | `GET/POST departments` · `PATCH/DELETE departments/:id` |
| Expenses | `GET/POST expenses` · `GET/PATCH/DELETE expenses/:id` · `POST expenses/:id/submit` · `POST expenses/:id/receipts` (multipart `file`) · `GET receipts/:id` |
| Approvals | `GET approvals/pending` · `GET approvals/expense/:id` · `POST approvals/:id/approve · reject · reimburse` |
| Cards | `GET/POST cards` · `GET/PATCH cards/:id` · `POST cards/:id/status` |
| Transactions | `GET transactions` · `GET transactions/:id` · `POST transactions/simulate` (`Idempotency-Key`) |
| Budgets | `GET/POST budgets` · `GET/PATCH/DELETE budgets/:id` · `GET/POST policies` · `PATCH/DELETE policies/:id` |
| Reports | `GET reports/dashboard · monthly · departments · employees · categories · budget-utilisation` (`?from&to&format=csv`) |
| Other | `GET notifications` · `PATCH notifications/:id/read` · `POST notifications/read-all` · `GET audit-logs` |

## Known limitations (read before relying on this)

* **One currency per organisation, no FX.** Expenses must be in the org's base currency; budget/limit math assumes that.
* **No email provider.** Invitation and password-reset tokens are returned in API responses when `NODE_ENV != production` (the web UI shows the link);
  in production they are *not* returned, so you must add an email sender before using invitations/reset in production.
* **Web tokens live in `localStorage`** (readable by XSS). Mitigated by short access-token TTL, rotation and the CSP in `apps/web/nginx.conf`; an httpOnly-cookie flow would be stronger.
* **Receipts are stored on local disk** (`UPLOAD_DIR`; a Docker volume in compose). Multi-instance deployments need shared storage (e.g. S3).
* **Rate limiting is in-memory per instance**; use a shared store behind multiple replicas.
* Tenant isolation is enforced in application code and covered by tests, not by Postgres row-level security.
* Budget threshold alerts are in-app notifications only (no email/push). Seeded data bypasses alerts, so the 75% alert for the seeded Sales budget will not fire retroactively.
* Seed/demo password is public; never seed a real environment.
* Not load-tested. Report queries use plain SQL over indexed tables and are fine for demo/SME scale; very large tenants would want materialised views.
* The mobile app's status is documented in `apps/mobile/README.md`.

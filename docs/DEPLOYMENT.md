# Deployment

## Environment variables (API)

| Var | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL 14+ URL |
| `JWT_ACCESS_SECRET` | yes | ≥ 32 random chars (enforced when `NODE_ENV=production`); `openssl rand -base64 48` |
| `ACCESS_TOKEN_TTL` | no | default `15m` |
| `REFRESH_TOKEN_TTL_DAYS` | no | default `30` |
| `UPLOAD_DIR` | no | default `./uploads`; mount a persistent volume |
| `CORS_ORIGINS` | no | comma-separated allow-list, e.g. `https://app.example.com` |
| `PORT` | no | default `3000` |
| `NODE_ENV` | no | `production` hides invite/reset tokens from API responses and enforces secret length |
| `THROTTLE_LIMIT`, `AUTH_THROTTLE_LIMIT` | no | requests/min per IP (default 300 / 10) |

Web: `VITE_API_URL` is baked in at build time (e.g. `https://api.example.com/api`).

## Production build

```bash
npm ci
npm run build -w apps/api && npm run build -w apps/web    # dist/ in each app
DATABASE_URL=... npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
NODE_ENV=production node apps/api/dist/main
```
Serve `apps/web/dist` from any static host / CDN with an SPA fallback to `index.html` (see `apps/web/nginx.conf`, incl. CSP).

## Docker

```bash
docker compose up --build -d                 # db :5433, api :3000, web :8080
docker compose exec api npm run seed         # optional demo data
```
The API image runs `prisma migrate deploy` on start. For real deployments set `JWT_ACCESS_SECRET`, `API_NODE_ENV=production`,
change the Postgres credentials, terminate TLS in front (set `trust proxy` is already enabled for one hop), and put the DB on managed storage with backups.

## Checklist before going live
- [ ] Email delivery for invitations and password reset (tokens are not returned in production)
- [ ] Shared object storage for receipts if running >1 API instance
- [ ] Shared rate-limit store (Redis) if running >1 instance
- [ ] TLS, HSTS and a CSP `connect-src` pinned to your API origin
- [ ] Log shipping + alerting; DB backups and a restore drill
- [ ] Rotate `JWT_ACCESS_SECRET` policy; remove or never run the demo seed

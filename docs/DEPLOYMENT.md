# Deployment

Architecture: Vercel (Next.js web) → proxies `/api/*` → Render (Express API) → MongoDB Atlas (M0).

## 1. MongoDB Atlas
1. Create a free M0 cluster. Create a database user with a letters-and-numbers password.
2. Network Access: allow `0.0.0.0/0` (Render IPs are not fixed).
3. Connection string: `mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/school_management?retryWrites=true&w=majority`
4. From a local shell with that value in `MONGODB_URI`: `npm run db:migrate` then `npm run db:seed`. Never run `db:reset` on live data.

## 2. Render (API)
- Web service from this repo, free instance, branch `main`.
- Build: `npm install --include=dev && npm run build --workspace=packages/shared && npm run build --workspace=apps/api`
- Start: `npm run start --workspace=apps/api`
- Health check path: `/api/health`
- Environment: `NODE_ENV=production`, `NODE_VERSION=20`, `MONGODB_URI`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `COOKIE_SECRET` (random, 32+ chars), `SCHOOL_TIMEZONE=Asia/Kolkata`, `ATTENDANCE_EDIT_WINDOW_DAYS=2`, `WEB_URL=<Vercel URL>`

## 3. Vercel (web)
- Root directory `apps/web`; install `cd ../.. && npm install`; build `cd ../.. && npm run build --workspace=packages/shared && cd apps/web && npm run build`
- Environment: `API_URL=<Render URL>` (no trailing slash; read at build time, redeploy after changing).

## 4. Smoke test
`/health` returns status ok through the web domain; log in as each demo role; mark attendance; pay a simulated invoice; check the `auth_token` cookie is HttpOnly and Secure.
# Phase 0 Walkthrough: Monorepo Bootstrap & Foundations

## 1. Plain-Language Explanation of What Was Built and Why

Phase 0 sets up the foundational infrastructure, development tooling, and quality gates for the School Management System:
- **npm Workspaces Monorepo (`package.json`, `packages/shared`, `apps/api`, `apps/web`):** Unifies backend, frontend, and shared contracts into a single repository while keeping concerns isolated.
- **Shared Validation & Types (`packages/shared/src/`):** Houses universal domain types, roles, statuses, and Zod schemas (`health.ts`, `error.ts`). Ensures both Express and Next.js speak the exact same contract.
- **Express 4 API Skeleton (`apps/api/src/`):** Implements an enterprise HTTP architecture with structured JSON logging (`pino`), unique trace tracking (`X-Request-ID`), standard RFC 7807 error envelopes, CORS, and Mongoose connection helpers targeting a MongoDB replica set (`rs0`).
- **Next.js 14 App Router Frontend (`apps/web/src/`):** Establishes the user interface foundation with Tailwind CSS and an automated proxy rewrite `/api/* → http://localhost:5000/api/*` ensuring same-origin cookie management without cross-origin friction. Includes an observability dashboard showing API health and cold-start alerts.
- **Docker Compose & Replica Set Automation (`infra/docker-compose.yml`, `scripts/wait-for-mongo.mjs`):** Spins up local MongoDB single-node replica sets (`rs0`) for development (`27017`) and testing (`27018`) with automated initialization, removing manual `rs.initiate()` steps.
- **GitHub Actions CI & Gitleaks (`.github/workflows/ci.yml`):** Automatically lints, typechecks, tests with coverage against a live MongoDB replica set, and scans for secret leaks on every push and pull request.

---

## 2. Request Flow for Main Feature (Health Check & Observability)

```
1. Browser Client (apps/web/src/app/page.tsx)
   ↓ fetch('/api/health')
2. Next.js App Router Proxy (apps/web/next.config.mjs)
   ↓ rewrites to http://localhost:5000/api/health
3. Express Ingress (apps/api/src/app.ts)
   ↓ requestIdMiddleware (generates or forwards X-Request-ID)
   ↓ requestLogger (pino-http logs request)
4. Health Controller Handler (apps/api/src/app.ts)
   ↓ getDbStatus() (queries mongoose.connection.readyState and replicaSet name)
5. Express Response
   ↓ 200 OK + HealthCheckResponse JSON payload + X-Request-ID header
6. Browser Client
   ↓ Parses JSON and renders status badge, DB connection state, and uptime
```

---

## 3. Likely "Live Change" Tasks & Files to Touch

1. **Task: Add a new custom health probe indicator (e.g. Memory Usage or Redis status)**
   - Touch `packages/shared/src/schemas/health.ts` (add `memory` field to `HealthCheckResponseSchema`).
   - Touch `apps/api/src/app.ts` (calculate `process.memoryUsage()` in `handleHealth`).
   - Touch `apps/web/src/app/page.tsx` (display memory stats in the UI status grid).
2. **Task: Change the default API port or add an environment configuration variable**
   - Touch `.env.example` (add variable definition and default value).
   - Touch `apps/api/src/config/env.ts` (add schema rule to `EnvSchema` with Zod validation).
   - Touch `README.md` (document variable in the Environment Variables table).
3. **Task: Modify the global error handler response envelope**
   - Touch `packages/shared/src/schemas/error.ts` (update `ApiErrorResponseSchema`).
   - Touch `apps/api/src/middleware/errorHandler.ts` (adjust JSON response formatting).
   - Touch `apps/api/tests/integration/health.test.ts` (update assertion expectations).

---

## 4. Five Questions a Reviewer Might Ask (With Answers)

1. **Q: Why use a single-node replica set (`rs0`) in Docker instead of a standalone Mongo container?**  
   *A:* MongoDB requires a replica set to enable multi-document ACID transactions (`session.withTransaction`). Since attendance bulk upserts, exam locking, and fee payments rely on atomic transactions, the development and test databases must run as a replica set from day one.

2. **Q: How does the setup avoid cross-origin cookie issues between Next.js and Express?**  
   *A:* Next.js App Router configures an internal rewrite in `next.config.mjs` (`/api/:path* → http://localhost:5000/api/:path*`). The browser only communicates with the Next.js origin (`localhost:3000`), treating all authentication cookies as same-origin (`SameSite=Lax`).

3. **Q: What is the purpose of the RFC 7807 error format?**  
   *A:* RFC 7807 provides a standardized, machine-readable Problem Details specification (`type`, `title`, `status`, `code`, `detail`, `errors`, `requestId`). It eliminates client parsing ambiguity and enables consistent error handling across the web client and API consumers.

4. **Q: How does the system handle Render free-tier cold starts?**  
   *A:* Free cloud tiers spin down inactive containers. The web frontend implements a cold-start detection timer (after 3 seconds of loading) displaying a clear warning to users that the server is waking up, accompanied by non-fatal health probes.

5. **Q: Why validate environment variables at startup with Zod?**  
   *A:* Failing fast on boot (`apps/api/src/config/env.ts`) ensures the service never enters a half-initialized runtime state due to missing secrets, misconfigured database URIs, or invalid port types.


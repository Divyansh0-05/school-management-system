# School Management System

[![CI](https://github.com/Divyansh0-05/school-management-system/actions/workflows/ci.yml/badge.svg)](https://github.com/Divyansh0-05/school-management-system/actions/workflows/ci.yml)

A full-stack School Management System for administrators, teachers and guardians: master data, daily attendance, exams with grading and report cards, and fee invoicing with an append-only ledger and simulated payments. Access control is enforced on the server for every request.

**Live demo:** https://school-management-system-three-murex.vercel.app
**API docs (Swagger):** `https://school-management-api-iic4.onrender.com/api/docs` · **OpenAPI file:** [`docs/openapi.json`](docs/openapi.json)
**Demo video:** `<VIDEO_URL>`

> The API runs on a free Render instance and sleeps after inactivity. The first request can take 30–60 seconds; later requests are fast.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, TanStack Query |
| Backend | Node.js 20, Express 4, TypeScript, layered: routes → controllers → services → repositories |
| Database | MongoDB 7 (Atlas M0 in production; local single-node replica set `rs0` for transactions), Mongoose 8, `$jsonSchema` validators, `migrate-mongo` migrations |
| Shared | `packages/shared`: Zod schemas and constants used by API and web |
| Testing | Vitest + Supertest against a real MongoDB replica set (115 tests), Playwright end-to-end tests, GitHub Actions CI |
| Hosting | Vercel (web), Render (API), MongoDB Atlas (database) |

The web app proxies `/api/*` to the API through a Next.js rewrite, so the session cookie is same-origin.

## Features

- **Master data (admin):** students, guardians, teachers, academic years, classes, sections, subjects, enrollments, teacher assignments, class subjects, fee heads, grading schemes. Paginated, searchable, validated, audited.
- **Attendance:** morning/afternoon sessions, idempotent bulk save (`PUT /sections/:id/attendance`), duplicate single record rejected with 409, teacher edit window, section and student summaries. School-local calendar dates.
- **Exams and results:** state machine `DRAFT → MARKS_OPEN → LOCKED → PUBLISHED`, per-subject marks entry, grading scheme snapshot taken on lock, integer-only grade math, dense ranking, printable report cards, section performance summary.
- **Fees:** itemised invoices, bulk generation per section, issue/void, append-only signed ledger, simulated card/UPI payments (success or failure) and cash receipts, idempotent payments via `Idempotency-Key`, fee summary and reconciliation reports.
- **Access control:** roles ADMIN, TEACHER, GUARDIAN. 401 unauthenticated, 403 wrong role, 404 for records outside the user's scope (no existence leak).
- **Audit trail:** append-only audit log written in the same transaction as the change; admin audit log viewer.
- **Security:** bcrypt (cost 12), httpOnly SameSite cookie session with a sliding 15-minute token, login lockout after 5 failures, login rate limiting, helmet, request-id logging with secret redaction.

## Acceptance criteria

| ID | Criterion | Evidence |
|---|---|---|
| A1 | Teacher accesses only assigned classes and records attendance | `attendance.test.ts`, e2e `attendance.spec.ts` |
| A2 | Duplicate attendance rejected or safely updated | `attendance.test.ts` (idempotent bulk, 409 on duplicate, 50 concurrent requests) |
| A3 | Exam result computed from configured marks and grading rules | `grading.test.ts`, `exams.test.ts` |
| A4 | Guardian sees only linked student data | `guardian-scoping.test.ts`, `students-scoping.test.ts` |
| A5 | Fee due and paid totals reconcile with the ledger | `fees.test.ts`, reconciliation report |

Full matrix: [`docs/ACCEPTANCE.md`](docs/ACCEPTANCE.md).

## Run locally

Requires Node.js 20+ and Docker Desktop.

```bash
cp .env.example .env
npm run docker:db:up     # MongoDB replica set (dev :27017, test :27018)
npm run setup            # install + build shared package
npm run db:migrate       # validators and indexes
npm run db:seed          # demo data
npm run dev              # API :5000, web :3000
```

Other commands:

```bash
npm run test             # API unit + integration tests (needs Docker DB)
npm run test:e2e         # Playwright end-to-end tests
npm run lint && npm run typecheck && npm run build
npm run db:reset         # DESTRUCTIVE: drops collections, re-migrates, re-seeds (local use only)
```

## Demo accounts

Password for all: `Demo@12345` (demo data only).

| Role | Email | Scope |
|---|---|---|
| Admin | `admin@school.demo` | Everything |
| Teacher | `teacher1@school.demo` | Sections 6A and 7A |
| Teacher | `teacher2@school.demo` | Section 6A only |
| Guardian | `guardian1@school.demo` | Two linked children |
| Guardian | `guardian2@school.demo` | One linked child |

## Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `NODE_ENV` | `development`, `test`, `production` | `development` |
| `PORT` | API port | `5000` |
| `API_URL` | API base URL used by the web rewrite (build time, no trailing slash) | `http://localhost:5000` |
| `WEB_URL` | Web origin, used for CORS | `http://localhost:3000` |
| `MONGODB_URI` | MongoDB connection string | local replica set |
| `MONGODB_TEST_URI` | Test database | local test replica set |
| `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `COOKIE_SECRET` | Secrets (set strong values in production) | dev defaults |
| `JWT_EXPIRES_IN` | Session token lifetime | `15m` |
| `AUTH_MAX_FAILED_LOGINS` | Failures before lockout | `5` |
| `AUTH_LOCKOUT_MINUTES` | Lockout duration | `15` |
| `ATTENDANCE_EDIT_WINDOW_DAYS` | Teacher edit window | `2` |
| `SCHOOL_TIMEZONE` | Day boundary timezone | `Asia/Kolkata` |
| `ALLOW_DEMO_SEED` | Allow seeding when `NODE_ENV=production` | unset |

No real secrets are committed; only `.env.example`.

## Deployment

Vercel (root `apps/web`, `API_URL` set to the Render URL) → Render (Node web service, health check `/api/health`) → MongoDB Atlas M0. Steps are in [`docs/DEPLOYMENT.md`](docs/SUBMISSION.md).

## Documentation

[Architecture](docs/ARCHITECTURE.md) · [Decisions (ADRs)](docs/DECISIONS.md) · [ER diagram](docs/ER_DIAGRAM.md) · [Acceptance matrix](docs/ACCEPTANCE.md) · [Known limitations](docs/KNOWN_LIMITATIONS.md) · [Technical report](docs/TECHNICAL_REPORT.md) · [Phase walkthroughs](docs/walkthrough)

## AI assistance

AI coding assistants (Google Antigravity and GitHub Copilot, using Claude and other models) were used to generate and iterate on large parts of the code, tests and documentation. I defined the requirements, architecture and data model, directed the work in phases (one branch and pull request per phase, CI on every PR), reviewed the output, ran the tests, deployed the system, and fixed defects found during manual testing on the live site. I can walk through and modify any part of the code. Working on this project helped me understand how things work in a real-world development environment. I learned a lot while building, testing, debugging and deploying it. There were challenges along the way, but solving them helped me improve my understanding of full-stack development.
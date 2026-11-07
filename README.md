# School Management System

[![CI](https://github.com/Divyansh0-05/school-management-system/actions/workflows/ci.yml/badge.svg)](https://github.com/Divyansh0-05/school-management-system/actions/workflows/ci.yml)

A full-stack School Management System built as a modular monolith to streamline and automate day-to-day school operations. The platform enables academic institutions to manage core master data (classes, sections, subjects, teachers, students, and guardians), record session-based daily attendance with strict idempotency and concurrency controls, conduct examinations with pure-function grading rules and printable report cards, process fee billing with an append-only ledger of signed entries and simulated multi-method payments, and enforce strict server-side role-based access control across administrators, teachers, and guardians.

## Planned Tech Stack

- **Frontend:** [Next.js](https://nextjs.org/) (App Router), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/) (Radix UI primitives for accessible design), and [TanStack Query](https://tanstack.com/query/latest)
- **Backend:** [Node.js](https://nodejs.org/) (v20+) with [Express](https://expressjs.com/), [TypeScript](https://www.typescriptlang.org/), designed with a strict layered architecture (`routes → controllers → services → repositories`)
- **Database & Persistence:** [MongoDB](https://www.mongodb.com/) (Atlas M0 for cloud deployment; local single-node replica set `rs0` for multi-document ACID transactions) with [Mongoose](https://mongoosejs.com/) ODM and `$jsonSchema` collection validators
- **Shared Contracts:** [Zod](https://zod.dev/) schemas in a shared package for end-to-end type safety and validation
- **Testing & Quality:** [Vitest](https://vitest.dev/) (unit and integration tests), [Supertest](https://github.com/ladjs/supertest) against a real MongoDB replica set, [Playwright](https://playwright.dev/) for end-to-end journey tests with automated axe accessibility checks, and [GitHub Actions](https://github.com/features/actions) CI

## Planned Features

- **Academic Administration:** Comprehensive management of students, guardians, teacher profiles, academic years, classes, sections, subjects, student enrollments, and teacher-subject-section assignments.
- **Attendance Management:** Daily session-based attendance tracking (Morning and Afternoon), idempotent bulk recording, duplicate submission protection, teacher editing windows, and aggregate attendance summaries for sections and students.
- **Exams and Results:** Exam lifecycle management (`DRAFT → MARKS_OPEN → LOCKED → PUBLISHED`), subject-wise marks entry, immutable grading scheme snapshotting upon lock, pure-function grade calculations without floating-point errors, dense ranking, and printable student report cards.
- **Fees & Simulated Payments:** Invoicing with itemized fee heads, section-wide bulk invoice generation, an append-only ledger of signed entries, idempotent simulated payments (Card, UPI, Cash) with version-checked atomic updates inside transactions, and automated reconciliation reports.
- **Role-Based Access Control (RBAC):** Centralized server-side authorization policies with scoped repository queries for Administrator, Teacher, and Guardian roles (returning 404 for out-of-scope records to prevent data-existence leakage).
- **Reports & Dashboards:** Dedicated dashboards for each user role, section performance analysis, fee collection and aging summaries, with on-demand CSV exports.
- **Audit Trail:** Immutable, append-only audit logging recording actor, role, timestamp, entity state before/after, IP, and request ID within the same database transaction as the business operation.

## Status

This project is under active development. Below is the project phase roadmap:

- [x] **Phase 0:** Bootstrap (Monorepo, Docker Compose MongoDB replica set, Express & Next.js skeletons, CI)
- [ ] **Phase 1:** Data Model, Auth, RBAC, Audit, and Master Data
- [ ] **Phase 2:** Attendance Management & Acceptance Tests (A1, A2)
- [ ] **Phase 3:** Exams, Grading Engine & Report Cards (A3)
- [ ] **Phase 4:** Fees, Invoices, Append-Only Ledger & Payments (A5)
- [ ] **Phase 5:** Guardian Portal, Dashboards, Reports & Accessibility (A4)
- [ ] **Phase 6:** Hardening, Security, E2E Testing & Production Deployment
- [ ] **Phase 7:** Documentation, Verification, Test Evidence & Final Submission Prep

## Setup & Quick Start

Ensure [Node.js](https://nodejs.org/) (v20+) and [Docker Desktop](https://www.docker.com/) are installed and running.

```bash
# 1. Clone repository & configure environment variables
cp .env.example .env

# 2. Start local MongoDB single-node replica set (rs0)
npm run docker:db:up

# 3. Install dependencies and build shared packages
npm run setup

# 4. Run test suites (unit and integration)
npm run test

# 5. Start development servers concurrently (API on :5000, Web on :3000)
npm run dev
```

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `NODE_ENV` | Runtime environment (`development`, `test`, `production`) | `development` |
| `PORT` | API server listen port | `5000` |
| `API_URL` | Base URL of the Express API backend | `http://localhost:5000` |
| `WEB_URL` | Base URL of the Next.js frontend | `http://localhost:3000` |
| `MONGODB_URI` | MongoDB connection string (requires replicaSet `rs0`) | `mongodb://localhost:27017/school_management?replicaSet=rs0` |
| `MONGODB_TEST_URI` | Dedicated test database connection string | `mongodb://localhost:27018/school_management_test?replicaSet=rs0` |
| `JWT_SECRET` | Secret key for signing authentication JWTs | required in production |
| `JWT_EXPIRES_IN` | Access token lifespan | `15m` |
| `REFRESH_TOKEN_SECRET` | Secret key for refresh tokens | required in production |
| `REFRESH_TOKEN_EXPIRES_IN`| Refresh token lifespan | `7d` |
| `COOKIE_SECRET` | Secret key for signed cookies | required in production |
| `ATTENDANCE_EDIT_WINDOW_DAYS` | Days within which teachers can modify attendance | `2` |
| `SCHOOL_TIMEZONE` | Timezone for day-boundary calculations | `Asia/Kolkata` |

## AI Assistance

This project is built with the help of an AI coding agent under the author's direction, supervision, and active architectural review. Full details regarding AI tooling, prompting workflows, and human review protocols will be added in the final README.


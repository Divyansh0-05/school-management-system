# Technical Report

## Overview
A modular monolith: Next.js web app, Express API, MongoDB. One repository (npm workspaces) with a shared package of Zod schemas used by both sides.

## Architecture
Routes validate input and attach auth, controllers translate HTTP, services hold business rules and transactions (`withTransaction`), repositories own all database access. Every mutation and its audit record commit in one MongoDB transaction. See `docs/ARCHITECTURE.md` and `docs/DECISIONS.md`.

## Data model
Collections for users, teachers, guardians, students, enrollments, academic structure, attendance, exams, marks, invoices, payments, ledger entries and audit logs. `$jsonSchema` validators and unique/partial indexes come from a migration. MongoDB has no foreign keys, so references are checked in services. See `docs/ER_DIAGRAM.md`.

## Key design decisions
- **Scoped 404s:** out-of-scope records return 404, wrong role returns 403 (ADR-005).
- **Attendance idempotency:** unique index on student/date/session, bulk upsert in a transaction, retry on duplicate-key races (ADR-003, ADR-009).
- **Grading:** marks as integer hundredths, integer half-up percentages, grading scheme snapshot on lock (ADR-002, ADR-010).
- **Fees:** money in integer paise, append-only signed ledger, outstanding derived from the ledger, `Idempotency-Key` with request hash, version-bumped invoice updates (ADR-004, ADR-007).
- **Auth:** bcrypt cost 12, httpOnly cookie JWT, timing-safe login, lockout after 5 failures (ADR-006).

## Security
Server-side RBAC on every route, rate-limited login, helmet, CORS limited to the web origin, secrets only in environment variables, logs redact cookies and headers, route-by-role test matrix.

## Testing
115 Vitest/Supertest tests on a real replica set (unit: grading, policy, fees, attendance summary; integration: auth, scoping, master data, attendance, exams, fees, audit, migrations, role matrix). Playwright covers admin master data, attendance, exams and fees journeys locally. CI runs lint, typecheck, tests with coverage and build.

## Trade-offs and limits
See `docs/KNOWN_LIMITATIONS.md`.

## Use of AI
AI coding assistants generated much of the code under my direction in reviewed phases; I tested, deployed and fixed defects found in live testing. Details in the README.
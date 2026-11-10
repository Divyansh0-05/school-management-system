# Architecture Decision Records (ADRs)

This document records the architectural and design decisions made throughout the lifecycle of the School Management System, following a concise ADR format.

---

## ADR-001: Monorepo Architecture and Technology Stack

- **Status:** Accepted
- **Date:** 2026-11-07
- **Context:** The application must deliver a full-stack, cohesive School Management System with strict type safety, shared validation contracts, multi-document ACID transactions, reproducible local development, and free-tier production deployment capabilities.
- **Decision:**
  - Structure the project as an npm workspaces monorepo: `apps/api` (backend), `apps/web` (frontend), `packages/shared` (common Zod schemas and types), `infra` (Docker configurations), and `docs` (technical architecture and ADRs).
  - Use TypeScript across all workspaces with `strict: true`.
  - Backend: Node.js (v20+) with Express, following a strict layered architecture (`routes → controllers → services → repositories`).
  - Database: MongoDB (Atlas M0 for cloud deployment; local Docker single-node replica set `rs0` for multi-document ACID transactions) with Mongoose ODM and `$jsonSchema` collection validators.
  - Frontend: Next.js (App Router), Tailwind CSS, shadcn/ui (Radix primitives for accessible components), and TanStack Query. A Next.js rewrite proxies `/api/*` to the Express backend to maintain same-origin cookie sessions.
  - Quality & CI: Vitest (unit & integration), Supertest, Playwright (E2E), and GitHub Actions.
- **Consequences:** Seamless sharing of schemas and types between frontend and backend, clear separation of concerns, and atomic database transactions.

---

## ADR-002: Grading Scheme Immutability & Snapshotting

- **Status:** Accepted
- **Date:** 2026-11-07
- **Context:** Modifying grading scheme bands while exams are active or published could silently alter historical student results or produce inconsistent transcripts.
- **Decision:**
  - Block modifications or deletions of any grading scheme once it is referenced by a non-DRAFT exam (`MARKS_OPEN`, `LOCKED`, or `PUBLISHED`).
  - When an exam transitions from `MARKS_OPEN` to `LOCKED`, snapshot the grading scheme definition into an embedded document `exams.grading_snapshot`.
  - Subsequent result calculations and report card generation reference `exams.grading_snapshot`.
- **Consequences:** Prevents retroactive grade changes and preserves audit integrity.

---

## ADR-003: Attendance Idempotency & Conflict Strategy

- **Status:** Accepted
- **Date:** 2026-11-07
- **Context:** Network retries, concurrent submissions, or accidental re-submits in the classroom must never corrupt attendance records, create duplicate rows, or leave student statuses inconsistent.
- **Decision:**
  - The primary web UI attendance workflow uses `PUT /api/v1/sections/:id/attendance` with an array of student statuses. This route performs an idempotent bulk upsert within a MongoDB transaction. If a record already exists it is updated; if not, it is created.
  - The single-record route `POST /api/v1/attendance` enforces duplicate rejection, returning `409 ATTENDANCE_ALREADY_RECORDED` if an entry already exists for the given student, date, and session.
  - A unique compound index on `(student_id, date, session)` is the final database-level guarantee against race conditions.
- **Consequences:** An idempotent safe-update path for the daily teacher workflow and an explicit conflict error for duplicate single-record submissions.

---

## ADR-004: Payment Simulation & Outcome Flag Handling

- **Status:** Accepted
- **Date:** 2026-11-07
- **Context:** For evaluation purposes, payment processing is simulated. Reviewers must be able to test both successful payments and failure recovery without moving real money.
- **Decision:**
  - `POST /api/v1/invoices/:id/payments` accepts a client-provided `simulatedStatus` (`SUCCEEDED` or `FAILED`), but **only** when the payment method is a simulated method (`SIMULATED_CARD` or `SIMULATED_UPI`). Cash receipts (`CASH`) recorded by administrators do not accept failure simulation.
  - Every payment request requires an `Idempotency-Key` header.
  - The request payload (including `simulatedStatus`) is hashed into `request_hash`. Replaying the same key with identical parameters returns the previous response (`200 OK` with `Idempotent-Replay: true`); reusing the key with different parameters returns `422 IDEMPOTENCY_KEY_REUSED`.
  - A failed payment creates a `FAILED` payment record for auditing but produces **no** ledger entry.
- **Consequences:** Safe idempotency, clear failure testing, and no impact on ledger reconciliation when payments fail.

---

## ADR-005: Authorization Scoping & Information Leak Prevention

- **Status:** Accepted
- **Date:** 2026-11-07
- **Context:** Confirming the existence of records belonging to other students or families (for example by returning 403 Forbidden on `/students/:id/report-card`) leaks private information.
- **Decision:**
  - **Route-level RBAC:** middleware verifies the token and user role. Unauthenticated requests to protected endpoints return `401`. A user whose role is not permitted on an endpoint (for example a guardian calling `POST /api/v1/exams`) receives `403`.
  - **Data-level scoping:** for permitted roles accessing resource-specific data (teachers querying sections, guardians querying students, report cards or invoices), repository queries are scoped to the user's permitted entity IDs.
  - If a teacher queries an unassigned section, or a guardian queries a student not linked to their account, nothing is found and the API returns `404`, not `403`.
- **Consequences:** No existence leaks, while role-level boundaries stay strict.

---

## ADR-006: Timing-Safe Authentication & Brute-Force Lockout

- **Status:** Accepted
- **Date:** 2026-11-08
- **Context:** Authentication endpoints are exposed to credential stuffing, brute-force attacks and user enumeration through response timing.
- **Decision:**
  - Passwords are hashed with `bcryptjs` at cost 12 or higher.
  - When an unknown email is submitted, the system still runs a bcrypt comparison against a dummy hash so timing is comparable to a real user check.
  - Failed login attempts are incremented atomically. After 5 consecutive failures the account is locked for 15 minutes (`locked_until = now + 15m`).
  - Invalid email, invalid password and deactivated accounts all return a uniform `401` with the generic detail "Invalid email or password".
- **Consequences:** Reduces user enumeration through timing or error messages and slows automated guessing.

---

## ADR-007: Append-Only Audit Logs and Financial Ledgers

- **Status:** Accepted
- **Date:** 2026-11-08
- **Context:** Audit reliability and financial integrity require that audit trail and ledger entries are never altered or deleted through the application, even by administrators.
- **Decision:**
  - The Mongoose schemas for `AuditLog` and `LedgerEntry` register pre-hooks that block update and delete operations (`updateOne`, `updateMany`, `replaceOne`, `findOneAndUpdate`, `deleteOne`, `deleteMany`, `findOneAndDelete`, `findOneAndReplace`).
  - The repositories for these collections expose only create and read operations; no update or delete methods exist.
  - Corrections are recorded as new offsetting entries (for example `REVERSAL`) that reference the original transaction.
- **Consequences:** Immutability is enforced at the application layer and covered by tests. Someone with direct database credentials could still change documents. A production hardening step would be a restricted database role without update/delete rights on these collections. This is listed in the known limitations.

---

## ADR-008: Phase 1B Master-Data Administration

- **Status:** Accepted
- **Date:** 2026-11-08
- **Decision:** Admin CRUD for the master collections is exposed through a shared routes/controllers/services/repository module. Every mutation runs in `withTransaction`, records an audit event with the same session, and translates duplicate-index errors and domain invariants into RFC 7807 `409` responses. Teacher and guardian creation also creates a bcrypt cost-12 user account in the same transaction.
- **Consequences:** Pagination, sorting, search, validation, authorization and audit behaviour stay consistent across resources. Relationship-specific checks live in services, while Mongoose access remains repository-owned. Because MongoDB does not enforce foreign keys, referential integrity (existence checks and blocked deletion of referenced records) is enforced in the service layer.

---

## ADR-009: Attendance Calendar Dates and Scoped Recording

- **Status:** Accepted
- **Date:** 2026-11-09
- **Decision:** Attendance stores the school-local calendar date as a strict `YYYY-MM-DD` string using `SCHOOL_TIMEZONE` (default `Asia/Kolkata`), never a UTC timestamp. Teacher writes are limited by `ATTENDANCE_EDIT_WINDOW_DAYS`; admins are unrestricted. Bulk writes validate the complete request before one transaction, upsert on `(student_id, date, session)`, and audit only creates or status changes in that same transaction.
- **Consequences:** Date boundaries cannot create timezone-dependent duplicates, retries are safe, and a failed audit write rolls back the attendance change. Scoped repository lookups return `404` for unassigned sections or unlinked students.

---

## ADR-010: Exams, Marks and Grading Calculation

- **Status:** Accepted
- **Date:** 2026-11-10
- **Decision:**
  - Marks are stored as integer hundredths; the API accepts decimals with at most two places. Percentages are computed with integer half-up rounding into integer hundredths of a percent, so no floating-point arithmetic is used for grades.
  - A grading scheme is copied into `exams.grading_snapshot` on LOCK (see ADR-002). Results use the snapshot from then on.
  - Exam state transitions and all marks changes, together with their audit rows, run in the same Mongo transaction. The exam service controls the state machine; invalid transitions return `409 INVALID_STATE_TRANSITION`.
- **Consequences:** Deterministic, testable grading and stable published results.
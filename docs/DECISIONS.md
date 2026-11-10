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
  - Frontend: Next.js (App Router), Tailwind CSS, shadcn/ui (Radix primitives for accessible AA-compliant components), and TanStack Query. Next.js rewrite proxies `/api/*` to the Express backend to maintain same-origin cookie sessions.
  - Quality & CI: Vitest (unit & integration), Supertest, Playwright (E2E), and GitHub Actions.
- **Consequences:** Ensures seamless code sharing of schemas and types between frontend and backend, enforces clear separation of concerns, and supports atomic database transactions.

---

## ADR-002: Grading Scheme Immutability & Snapshotting

- **Status:** Accepted
- **Date:** 2026-11-07
- **Context:** Modifying grading scheme bands while exams are active or published could silently alter historical student results, violate audit compliance, or produce inconsistent transcripts.
- **Decision:**
  - Block modifications or deletions of any grading scheme once it is referenced by a non-DRAFT exam (`MARKS_OPEN`, `LOCKED`, or `PUBLISHED`).
  - When an exam transitions from `MARKS_OPEN` to `LOCKED`, snapshot the entire grading scheme definition into an embedded document `exams.grading_snapshot`.
  - Subsequent result calculations and report card generations strictly reference `exams.grading_snapshot`, guaranteeing immutable grade preservation.
- **Consequences:** Prevents retroactive grade changes and preserves audit integrity with zero runtime ambiguity.

---

## ADR-003: Attendance Idempotency & Conflict Strategy

- **Status:** Accepted
- **Date:** 2026-11-07
- **Context:** Network retries, concurrent submissions, or accidental re-submits in the classroom must never corrupt attendance records, create duplicate rows, or leave student statuses inconsistent.
- **Decision:**
  - The primary web UI attendance recording workflow strictly uses `PUT /api/v1/sections/:id/attendance` with an array of student statuses. This route performs an idempotent bulk upsert within a MongoDB transaction. If a record already exists, it is updated; if not, it is created.
  - The single-record route `POST /api/v1/attendance` enforces duplicate rejection, returning `409 ATTENDANCE_ALREADY_RECORDED` if an entry already exists for the given student, date, and session.
  - A unique compound database index `UNIQUE(student_id, date, session)` serves as the final database-level guarantee against race conditions.
- **Consequences:** Provides both an idempotent safe-update path for the daily teacher workflow and an explicit conflict error for duplicate single-record submissions.

---

## ADR-004: Payment Simulation & Outcome Flag Handling

- **Status:** Accepted
- **Date:** 2026-11-07
- **Context:** For evaluation purposes, payment processing is simulated. Reviewers must be able to test both successful payment workflows and failure recovery paths without moving real money.
- **Decision:**
  - The payment endpoint `POST /api/v1/invoices/:id/payments` accepts a client-provided `simulatedStatus` (either `SUCCEEDED` or `FAILED`), but **only** when the payment method is a simulated method (`SIMULATED_CARD` or `SIMULATED_UPI`). Real-world cash receipts (`CASH`) recorded by administrators do not accept failure simulation.
  - Every payment request requires an `Idempotency-Key` header.
  - The request payload (including the `simulatedStatus`) is hashed into `request_hash`. Replaying the same idempotency key with identical parameters returns the previous cached response (`200 OK` with `Idempotent-Replay: true`), while reusing the key with differing parameters returns `422 IDEMPOTENCY_KEY_REUSED`.
  - A failed payment creates a `FAILED` payment record for auditing but produces **no** ledger entry.
- **Consequences:** Ensures safe idempotency guarantees, clear failure testing, and zero impact on financial ledger reconciliation when payments fail.

---

## ADR-005: Authorization Scoping & Information Leak Prevention

- **Status:** Accepted
- **Date:** 2026-11-07
- **Context:** In educational systems, confirming the existence of records belonging to other students or families (e.g. returning 403 Forbidden on `/students/:id/report-card`) leaks private information about student enrollment.
- **Decision:**
  - **Route-Level RBAC:** Middleware verifies token validity and user role. If an unauthenticated user calls any protected endpoint, return `401 Unauthorized`. If a user with role `GUARDIAN` calls an administrative endpoint (e.g. `POST /api/v1/exams`), return `403 Forbidden`.
  - **Data-Level Tenancy Scoping:** For authorized roles accessing resource-specific data (teachers querying sections, guardians querying students/report cards/invoices), repository-level queries are automatically scoped to the user's permitted entity IDs.
  - If a teacher queries an unassigned section, or a guardian queries a student not linked to their guardian account, the query returns no documents, triggering a standard `404 Not Found` rather than a `403 Forbidden`.
- **Consequences:** Eliminates data existence leaks while maintaining strict role-level security boundaries.

---

## ADR-006: Timing-Safe Authentication & Brute-Force Lockout

- **Status:** Accepted
- **Date:** 2026-11-08
- **Context:** User authentication endpoints are vulnerable to credential stuffing, brute-force dictionary attacks, and user-enumeration side-channel timing attacks.
- **Decision:**
  - Passwords are hashed using `bcryptjs` with salt work factor of at least 12.
  - When a non-existent email is provided during login, the system still runs a bcrypt comparison against a dummy salt hash to ensure execution time is indistinguishable from an existing user check (preventing email enumeration via timing side-channels).
  - Failed login attempts are incremented atomically. Upon reaching 5 consecutive failures, the account is locked for 15 minutes (`locked_until = now + 15m`).
  - Responses for invalid email, invalid password, or deactivated accounts return a uniform `401 Unauthorized` with generic detail "Invalid email or password".
- **Consequences:** Eliminates user enumeration via response timing or error messages and defends against automated credential stuffing.

## ADR-008: Phase 1B Master-Data Administration

- **Status:** Accepted
- **Date:** 2026-11-08
- **Decision:** Admin CRUD for the Phase 1A master collections is exposed through a shared routes/controllers/services/repository module. Every mutation runs in `withTransaction`, records an audit event with the same session, and translates duplicate indexes and domain invariants into RFC 7807 `409` responses. Teacher and guardian creation creates a bcrypt cost-12 user account in that transaction.
- **Consequences:** Pagination, sorting, search, validation, authorization, and audit behavior remain consistent across resources. Relationship-specific checks stay in the service while Mongoose access remains repository-owned.

---

## ADR-007: Append-Only Immutability for Audit Logs and Financial Ledgers

## ADR-009: Attendance Calendar Dates and Scoped Recording

- **Status:** Accepted
- **Date:** 2026-11-09
- **Decision:** Attendance stores the school-local calendar date as a strict `YYYY-MM-DD` string using `SCHOOL_TIMEZONE` (default `Asia/Kolkata`), never a UTC timestamp. Teacher writes are limited by `ATTENDANCE_EDIT_WINDOW_DAYS`; admins are unrestricted. Bulk writes validate the complete request before one transaction, upsert on `(student_id, date, session)`, and audit only creates or status changes in that same transaction.
- **Consequences:** Date boundaries cannot create timezone-dependent duplicates, retries are safe, and failed audit writes roll back attendance changes. Scoped repository lookups return 404 for unassigned sections or unlinked students.s and Financial Ledgers

- **Status:** Accepted
- **Date:** 2026-11-08
- **Context:** Regulatory compliance, audit reliability, and financial integrity require that audit trails and financial ledger entries can never be altered or deleted, even by administrative users.
- **Decision:**
  - The Mongoose schemas for `AuditLog` and `LedgerEntry` register strict pre-hooks blocking all update and delete methods (`updateOne`, `updateMany`, `replaceOne`, `findOneAndUpdate`, `deleteOne`, `deleteMany`, `findOneAndDelete`, `findOneAndReplace`).
  - Repository interfaces for these collections expose only `create` / `createMany` and query (`find`, `findById`) operations; no update or deletion signatures exist in code.
  - Financial adjustments and corrections must be recorded as new offsetting ledger entries (`entry_type: REVERSAL` or `ADJUSTMENT`) with an explicit reference to the parent transaction.
- **Consequences:** Guarantees cryptographically verifiable immutability and complete historical traceability.
## Phase 3A: Exams and grading

- Marks are stored as integer hundredths, while API input accepts decimal values with at most two places. Percentages are calculated with integer half-up rounding to integer hundredths of a percent.
- A grading scheme is copied into `exams.grading_snapshot` during LOCK. Results use that immutable snapshot thereafter, so later scheme edits cannot change published history.
- Exam dates and state transitions are controlled by the exam service; all marks and state changes plus audit rows run in the same Mongo transaction.

# AGENTS.md — Contributor & AI Agent Conventions

This document defines core engineering standards, architectural boundaries, and operational rules for working in this repository.

## 1. Architectural Layering Rules (Strictly Enforced)

All backend code inside `apps/api` must adhere to a strict layered architecture:
```
Routes → Controllers → Services → Repositories (Mongoose)
```
- **Controllers:** Responsible only for HTTP protocol handling (extracting params, calling services, returning standard response shapes). No business logic and no database queries.
- **Services:** Contain 100% of the domain and business rules. Open database transaction sessions and pass them down to repositories. Never invoke raw Mongoose models directly.
- **Repositories:** Sole interface to Mongoose models. Wrap queries, updates, and aggregations. Handle tenant and scope filtering.
- **Shared Validation:** All input schemas and DTOs live in `packages/shared` via Zod and are shared between `apps/api` and `apps/web`.

## 2. Integrity & Financial Rules

- **Zero Floating-Point Math:** All financial amounts are stored as integer **paise** (1 INR = 100 paise). All marks are stored as integer **hundredths** (e.g. 85.50% = 8550).
- **Append-Only Immutability:** Financial ledgers and audit logs are append-only. Repositories expose `create` and `find` methods only — no `update` or `delete` paths exist.
- **Atomic Concurrency:** State transitions and financial deductions use version-checked atomic operations inside MongoDB multi-document transactions with retry logic on `TransientTransactionError`.
- **404 vs 403:** Scoped resource queries (e.g. teachers or guardians accessing records outside their assignment or family) return **404 Not Found** to prevent data existence leakage. Unauthenticated requests return **401**; role-based access violations on admin routes return **403**.

## 3. Essential Commands

```bash
# Setup dependencies and build shared packages
npm run setup

# Run MongoDB single-node replica set locally
npm run docker:db:up

# Start both API and Web applications concurrently
npm run dev

# Run all test suites (unit + integration)
npm run test

# Typecheck all workspaces
npm run typecheck

# Lint all workspaces
npm run lint

# Build all packages and applications
npm run build
```

## 4. Quality & Verification Protocol

- **Run all checks before finishing:** Never consider a task or phase done without executing `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- **Test Evidence:** Always record actual terminal output and ensure 100% passing tests before committing.
- **Conventional Commits:** Use standard prefixes (`feat:`, `fix:`, `test:`, `docs:`, `chore:`) on dedicated branches (`phase/N-<name>`).


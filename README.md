# School Management System

A robust, enterprise-grade, full-stack School Management System built as a modular monolith to streamline and automate day-to-day school operations. The platform enables academic institutions to manage core master data (classes, sections, subjects, teachers, students, and guardians), record session-based daily attendance with strict idempotency and concurrency controls, conduct examinations with pure-function grading rules and printable report cards, process fee billing with an immutable, append-only financial ledger and simulated multi-method payments, and enforce strict server-side role-based access control across administrators, teachers, and guardians.

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
- **Fees & Simulated Payments:** Invoicing with itemized fee heads, section-wide bulk invoice generation, an append-only double-entry financial ledger, idempotent simulated payments (Card, UPI, Cash) with optimistic row-level locking, and automated reconciliation reports.
- **Role-Based Access Control (RBAC):** Centralized server-side authorization policies with scoped repository queries for Administrator, Teacher, and Guardian roles (returning 404 for out-of-scope records to prevent data-existence leakage).
- **Reports & Dashboards:** Dedicated dashboards for each user role, section performance analysis, fee collection and aging summaries, with on-demand CSV exports.
- **Audit Trail:** Immutable, append-only audit logging recording actor, role, timestamp, entity state before/after, IP, and request ID within the same database transaction as the business operation.

## Status

This project is under active development. Below is the project phase roadmap:

- [ ] **Phase 0:** Bootstrap (Monorepo, Docker Compose MongoDB replica set, Express & Next.js skeletons, CI)
- [ ] **Phase 1:** Data Model, Auth, RBAC, Audit, and Master Data
- [ ] **Phase 2:** Attendance Management & Acceptance Tests (A1, A2)
- [ ] **Phase 3:** Exams, Grading Engine & Report Cards (A3)
- [ ] **Phase 4:** Fees, Invoices, Append-Only Ledger & Payments (A5)
- [ ] **Phase 5:** Guardian Portal, Dashboards, Reports & Accessibility (A4)
- [ ] **Phase 6:** Hardening, Security, E2E Testing & Production Deployment
- [ ] **Phase 7:** Documentation, Verification, Test Evidence & Final Submission Prep

## Setup

Coming in Phase 0.

## AI Assistance

This project is built with the help of an AI coding agent under the author's direction, supervision, and active architectural review. Full details regarding AI tooling, prompting workflows, and human review protocols will be added in the final README.

# Phase 3A Walkthrough: Exams API

## What was built

The API now supports admin exam CRUD, the DRAFT → MARKS_OPEN → LOCKED → PUBLISHED lifecycle, reasoned LOCKED reopening, transactional teacher-scoped mark entry, immutable grading snapshots, section results, report cards, and section-performance reports. Marks and percentages use integer hundredths throughout, and the deterministic seed includes a published boundary/absent/tie fixture plus a partial MARKS_OPEN exam.

## Marks PUT flow

The route authenticates and validates the section, subject, student IDs, absent/marks combination, decimal precision, and max-mark bound. The service scopes teachers to their `(section, subject)` assignment, verifies MARKS_OPEN, then upserts every mark inside one Mongo transaction. Each create or actual value change calls the audit helper with the same session; an audit failure aborts the complete write.

## Lock and snapshot flow

The admin transition opens one transaction, verifies every current class enrollment has a mark or absent row for every exam subject, copies the current grading bands into `grading_snapshot`, changes the state to LOCKED, and writes the transition audit entry. Published results read the snapshot, not the mutable grading-scheme document.

## Likely live changes

1. Add a grade band: update the shared grading-band schema and grading tests in `packages/shared/src/schemas/exams.ts` and `apps/api/tests/unit/grading.test.ts`.
2. Change the pass rule: update `apps/api/src/modules/exams/grading.ts` and the hand-calculated integration expectations.
3. Add GPA: extend the pure result shape in `apps/api/src/modules/exams/grading.ts`, then expose it in the report-card controller contract and tests.

## Reviewer Q&A

1. **Why integer marks?** Integer hundredths remove floating-point drift and match the repository financial/marks invariant.
2. **Why snapshot on LOCK?** Historical results must remain stable when an administrator later edits a scheme.
3. **Why are teacher scope failures 404?** Assignment scope is hidden to avoid leaking other sections or subjects.
4. **Why does LOCK reject partial data?** A locked exam must be reproducible for every enrolled student and subject, including explicit absences.
5. **How are ties ranked?** Dense ranking assigns equal totals the same rank and advances by one distinct total.

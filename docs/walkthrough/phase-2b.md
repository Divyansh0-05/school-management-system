# Phase 2B Walkthrough: Attendance UI

## What was built

Teachers now have a scoped My classes page, attendance sheets with date/session selection, keyboard-accessible status controls, mark-all-present, counts, dirty-state protection, friendly API errors, retry/loading/empty states, and a date-range summary. Admins can open the same sheet and summary from an Attendance menu entry. Guardians see read-only cards for the children returned by the existing scoped `GET /students` API.

## Save flow

1. A teacher selects a status in the shared attendance sheet component.
2. The component sends all enrolled student statuses to `PUT /api/v1/sections/:id/attendance` through the same-origin rewrite.
3. Express validates the shared contract, checks the teacher's section scope/edit window, upserts rows in one Mongo transaction, and writes status-change audits.
4. TanStack Query invalidates the sheet; reloading reads the persisted rows from `GET /sections/:id/attendance`.

## Likely live changes

1. Add a new status: update `packages/shared/src/schemas/attendance.ts` and the status options in `apps/web/src/components/attendance-ui.tsx`.
2. Add a teacher dashboard metric: update `apps/web/src/app/teacher/page.tsx` and `TeacherSections` in `attendance-ui.tsx`.
3. Change summary date defaults: update the `range` initialization in `GuardianChildren` and `AttendanceSheet`.

## Reviewer Q&A

1. **Can a teacher access another section by URL?** No; the scoped sections query omits it and the client routes to the 404 page.
2. **Where are tokens stored?** In the existing httpOnly cookie; the UI does not use localStorage.
3. **What happens when the edit window closes?** The API code `EDIT_WINDOW_CLOSED` becomes a clear inline save message.
4. **How is the sheet accessible?** Every status is a labelled native select with visible focus, and save messages/counts use live regions.
5. **Why no `/me/students` endpoint?** Existing guardian-scoped `GET /students` already returns only linked children, so no API change was necessary.

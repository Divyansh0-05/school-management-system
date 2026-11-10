# Phase 3B Walkthrough: Exams UI

## What was built

Admin exam list/filter/create/edit/detail screens, lifecycle controls, results and performance tables, teacher-scoped My Exams and marks entry, printable report cards for admin/teachers/guardians, and the seeded teacher/guardian Playwright journey are implemented with the existing query, auth, toast, responsive, and accessibility patterns.

## Marks save flow

The teacher opens a MARKS_OPEN exam, selects the assigned section, edits decimal marks or checks Absent, and presses Save. The shared web API wrapper sends the bulk records through the same-origin rewrite to `PUT /api/v1/exams/:examId/subjects/:subjectId/marks`; the API validates scope and values, upserts marks and audit rows in one transaction, then TanStack Query invalidates the marks query so the persisted values reload.

## Likely live changes

1. Add subject names to result tables: populate the exam subject response in `apps/api/src/modules/exams/exams.service.ts` and render the label in `apps/web/src/components/exams-ui.tsx`.
2. Add a section selector for multi-section teachers: extend `ExamDetail` and the marks query controls in `apps/web/src/components/exams-ui.tsx`.
3. Add a PDF export action: extend the print stylesheet in `apps/web/src/app/globals.css` or add a server report endpoint.

## Reviewer Q&A

1. **Why are teacher exams scoped?** The API filters class IDs from the teacher's section assignments before pagination.
2. **Why can guardians see only published cards?** Guardian exam discovery is forced to PUBLISHED and report-card access also verifies the family link.
3. **What happens when Lock fails?** The UI maps `INCOMPLETE_MARKS` to an actionable message and leaves the exam state unchanged.
4. **How is unsaved data protected?** Marks entry installs a browser unload warning while the local values differ from the last successful load/save.
5. **How does printing stay accessible?** The report card has a labelled print button and print CSS hides navigation and controls while preserving the report content.

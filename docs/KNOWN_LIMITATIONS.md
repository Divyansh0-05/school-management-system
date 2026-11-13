# Known Limitations

An honest list of scope boundaries and trade-offs.

1. **Simulated payments.** No real money moves. Methods are `SIMULATED_CARD`, `SIMULATED_UPI` (with a success/failure switch) and admin-recorded `CASH`.
2. **No notifications.** No SMS or email is sent. Events are visible in the audit log and dashboards only.
3. **One current academic year.** The schema supports several years; day-to-day screens use the year marked current.
4. **No student logins.** Students are viewed through their guardian's account.
5. **No refunds or chargebacks.** The ledger supports `REVERSAL` entries, but there is no refund workflow.
6. **Free-tier cold starts.** The Render API sleeps when idle; the first request can take 30–60 seconds. There is no "waking up" banner in the UI.
7. **Immutability is enforced in the application.** Audit and ledger collections are append-only through the app (Mongoose hooks, insert/read-only repositories, tested). Someone with raw database credentials could still change them; production hardening would use a database role without update/delete rights.
8. **MongoDB has no foreign keys.** References are checked in the service layer and by indexes/validators.
9. **Sessions.** The JWT is renewed on each authenticated request (sliding 15 minutes). There is no refresh-token rotation and no server-side revocation list; logging out clears the cookie.
10. **Reports.** Fee summary and reconciliation, attendance summaries and section performance exist. There are no CSV exports and no fee aging report.
11. **Accessibility.** Semantic tables, labels and focus styles are used, but there are no automated accessibility (axe) checks.
12. **End-to-end tests are not in CI.** Playwright tests run locally (`npm run test:e2e`); CI runs lint, typecheck, API tests with coverage, and build.
13. **Single timezone.** One school timezone (`SCHOOL_TIMEZONE`) is used for attendance dates.
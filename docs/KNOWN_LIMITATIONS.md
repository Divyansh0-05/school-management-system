# Known Limitations & Design Boundaries

This document maintains an honest, transparent record of scope boundaries and architectural trade-offs within the School Management System.

1. **Simulated Payment Gateway:** No real money transitions occur. Payment flows support `SIMULATED_CARD`, `SIMULATED_UPI`, and `CASH` with an explicit simulator toggle (Success/Failure) to test ledger consistency and idempotency safely.
2. **External Notification Channels (SMS/Email):** System operations do not dispatch real SMS or email notifications. Communication is simulated or delivered via in-app audit trails and dashboards.
3. **Single Active Academic Year:** Although the database schema supports multiple historical academic years, day-to-day operations and active enrollments resolve against the single year marked `is_current: true`.
4. **No Direct Student Logins:** Access is tailored for Administrators, Teachers, and Guardians. Students view their records and report cards via their registered guardian's portal.
5. **Fee Refunds / Chargebacks:** While ledger reversals are supported structurally (`REVERSAL` ledger entry type), complex multi-currency adjustments and automated merchant refunds are out of scope.
6. **Free-Tier Cold Starts:** When hosted on free cloud tiers (such as Render), the API server may idle after inactivity, resulting in a 30–60 second latency on initial boot. The web client includes an explicit "Waking up server..." status banner to inform users during cold starts.


# Phase 4B Fees UI and Admin Dashboard

## What was built

Admins now have invoice, fee-report, audit-log, and KPI dashboard screens. Guardians can open linked invoices and use a clearly labelled simulated Card/UPI payment flow with success/failure outcomes and idempotency keys. The API adds admin-only dashboard and paginated audit-log endpoints, plus dedicated guardian scoping coverage.

## Payment flow

The guardian clicks an invoice and then Pay (simulated). The screen converts rupees to integer paise, shows the simulation warning, sends a fresh attempt key, and displays the API result. The API validates scope and idempotency, locks the invoice in a Mongo transaction, writes a payment and successful ledger entry when appropriate, updates status, and refreshes the invoice query.

## Likely live changes

1. Add a new payment method in `packages/shared/src/constants/status.ts` and `apps/api/src/models/Payment.ts`.
2. Add dashboard KPIs in `apps/api/src/modules/admin/admin.service.ts` and `apps/web/src/components/admin-dashboard.tsx`.
3. Add overdue/late-fee presentation in `apps/api/src/modules/fees/fees.service.ts` and `apps/web/src/components/fees-ui.tsx`.

## Reviewer Q&A

**Does the UI move real money?** No. Card and UPI are explicitly simulated.

**How are retries safe?** The attempt key is reused for a retry, and the API returns the original payment on replay.

**Can guardians view another family's invoice?** No; resource reads return 404.

**Where is reconciliation shown?** Admin Fee reports displays the mismatch table or an all-clear state.

**Why are amounts converted to paise?** The API and ledger use integer paise to avoid floating-point monetary errors.

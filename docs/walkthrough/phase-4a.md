# Phase 4A Fees API

## What was built

The API now supports admin invoice CRUD, section invoice generation, issue/void transitions, append-only fee ledgers, simulated payments, payment and ledger reads, and fee summary/reconciliation reports. Amounts are integer paise throughout, and invoice/receipt numbers use transactional counters.

## Payment flow

`POST /api/v1/invoices/:id/payments` validates the role, idempotency key, method, and request hash. The service opens one Mongo transaction, takes a conditional invoice write lock by incrementing `version`, derives outstanding from ledger entries, allocates a receipt number, inserts the payment, appends a negative `PAYMENT` entry for successful outcomes, updates status, and records the audit event using the same session. A replay returns the original payment without creating another row.

## Likely live changes

1. Add late-fee rules in `apps/api/src/modules/fees/fees.service.ts`.
2. Change overpayment behavior and error mapping in `apps/api/src/modules/fees/fees.service.ts`.
3. Add a payment method in `packages/shared/src/constants/status.ts`, the payment schema, and `apps/api/src/models/Payment.ts`.

## Reviewer Q&A

**Why integer paise?** To avoid floating-point monetary errors.

**How is a duplicate payment prevented?** A unique payer/key index plus request-hash replay check runs inside the transaction.

**Why is outstanding not stored?** The signed ledger is the source of truth and can be reconciled.

**Can a guardian pay another family?** No; the resource is deliberately returned as 404.

**Can a void invoice have a payment?** No; voiding with successful payments returns `INVOICE_HAS_PAYMENTS`.

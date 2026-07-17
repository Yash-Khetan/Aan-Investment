# Payments Feature

Record a repayment against a loan (SRS §11: payment appropriation waterfall —
penalty → interest → principal by default, or the loan's configured order).
Recording a payment also posts accounting journal entries automatically on
the backend — no separate accounting call is needed here.

## API

Mounted at `/payments`, wrapped in `{ success, data }`:

- `POST /payments` — record a payment; applies it across buckets via the
  loan's waterfall config (falls back to `PENALTY → INTEREST → PRINCIPAL` if
  none configured), optionally updates a linked installment. Response is
  `{ payment, allocation, waterfallResult }`.
- `GET /payments/:loanId` — payment history for a loan, newest first.

On a successful record, the page invalidates both the Repayment Engine's
`["repayment-schedule", loanId]` query (so installment status stays in sync)
and this feature's own `["payments", loanId]` query (so the history table
refreshes immediately).

## Cross-feature reuse

Reuses `features/repayment/api.ts` (`getSchedule`) to list a loan's pending/
partial installments so the operator can optionally pick one — selecting an
installment auto-fills `outstandingPrincipal`/`outstandingInterest` from that
installment's remaining balance (still editable). `outstandingPenalty` has no
source on the installment row, so it always starts at `0` and must be entered
manually if applicable. `receivedBy` is auto-set to the logged-in user via
`useAuth()`.

## Files

- `types.ts` — `PaymentMode`, `Payment`, `PaymentAllocation`, `WaterfallResult`,
  `RecordPaymentInput/Result`
- `api.ts` — `recordPayment`, `getPaymentHistory`
- `PaymentsPage.tsx` — loan picker + record form + payment history table
- `components/RecordPaymentForm.tsx` — the form, installment picker, and
  post-submit waterfall result display

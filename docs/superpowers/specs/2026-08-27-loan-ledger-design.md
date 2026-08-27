# Loan-Keyed Ledger — Design

**Date:** 2026-08-27
**Status:** Approved, pending implementation plan

## Problem

The ledger module is keyed on borrower. A borrower with three loan accounts gets
one merged running account, so per-loan interest and TDS cannot be read off it.
The ledger must instead be keyed on the loan account, and the rates it uses must
be the same values the loan master holds — not a second copy that drifts.

## Goal

Re-key the existing ledger to `loanId` and make the loan row the single source of
truth for the Interest and TDS rates. Every calculation the module performs today
stays byte-for-byte identical.

## Non-goals

- No change to the interest/TDS math, the running-balance walk, the month-end
  auto-generation, or the backdated-entry cascade.
- No retro-recompute of posted months when a loan's rate changes.
- No renaming of files, tables, or route paths.
- No migration of existing ledger rows (test data only — dropped).

## Decisions

| Question | Decision |
| --- | --- |
| What syncs to the loan master | Interest rate and TDS rate only |
| Sync mechanism | Loan row is the single source of truth; the settings table is deleted |
| Per-row rate edit | Stays local to that Journal row; never writes to the loan |
| Existing ledger data | Dropped, start fresh |
| Naming | Files, tables, and routes keep their `borrower` names; only the FK column changes |
| Accrual start month | Unchanged — the month of the earliest ledger entry |

Rejected: a two-way sync helper between `borrower_ledger_settings` and `loans`
(two writers per value, silent drift when a call path is missed), and a read-only
rate mirror in the ledger (would remove the working rate panel).

## Architecture

### Schema

`borrower_ledger_entries` — one column swap:

- `borrower_id uuid → borrowers.id` becomes `loan_id uuid → loans.id`, `ON DELETE CASCADE`.
- All four indexes re-point to `loan_id`. The unique constraints on `vch_no` and
  on `(accrual_month, vch_type)` now scope per loan, so each loan account has its
  own voucher-number sequence and its own idempotent month-end guard.
- Every other column is untouched.

`borrower_ledger_settings` — dropped. Its two columns move to the loan row.

`loans` — add one column:

- `tds_rate_percent numeric(5,2) NOT NULL DEFAULT '10'`. The default matches the
  ledger's previous default, so existing loans behave as before.
- The existing `interest_rate numeric(8,4)` becomes the ledger's interest source.

### Repository (`borrowerLedger.repository.ts`)

Mechanical `borrowerId → loanId` rename across every query. Two functions are
replaced rather than renamed:

- `getOrCreateSettings(borrowerId)` becomes `getLoanRates(loanId)` — selects
  `interestRate` and `tdsRatePercent` from `loans`, throws if the loan is missing.
  The get-or-create race handling disappears with the table; a loan always exists
  before its ledger does.
- `updateSettings(borrowerId, ...)` becomes `updateLoanRates(loanId, ...)` —
  updates both columns on `loans`.

`getNextVchNo` now counts per loan, so each loan account numbers 1, 2, 3…
independently.

### Service (`borrowerLedger.service.ts`)

No calculation changes. `assembleMonthBalanceEvents`,
`computeMonthInterestAndTds`, `generateMonthEndJournalPair`,
`syncMissingMonthEndJournals`, `recomputeMonthsFrom`, `editJournalEntryRate`, and
the running-balance walk in `getBorrowerLedger` keep their current logic; only the
identifier parameter is renamed and the rate lookup is re-pointed at the loan.

`getSettings()` still returns `{ defaultInterestRatePercent, defaultTdsRatePercent }`,
now mapped from the loan row. Holding that shape keeps the frontend rate panel and
its API client unchanged.

### Routes and controller

Path stays `/borrower-ledger`. The route parameter becomes `:loanId` and the two
param validators change their key accordingly. The rate validator widens to four
decimal places to match `numeric(8,4)`.

### Frontend

- `BorrowerLedgerPage.tsx` — swap `BorrowerSelect` for the existing `LoanSelect`,
  rename the state variable, retitle the page "Loan Ledger", and reword the empty
  state to "Select a loan to view or add records."
- `api.ts` — parameter rename only; the URLs do not change.
- `AddEntryForm`, `RateSettingsPanel`, `LedgerTable` — prop rename only. No
  behavior change.
- `Layout.tsx` — nav label becomes "Loan Ledger"; the path stays `/borrower-ledger`.

### Write-back

Saving the rate panel issues the existing `PUT`, which now writes
`loans.interest_rate` and `loans.tds_rate_percent`. The loan detail view reads
those columns, so the change is visible there immediately.

The reverse direction needs no code: editing the rate in the loan master changes
the same columns the ledger reads on its next request.

Posted Journal rows keep their own `rate_percent` and are not recomputed when the
loan's rate changes. This preserves current behavior, where each accrued month
retains the rate it accrued at.

## Data flow

1. User picks a loan. `GET /borrower-ledger/:loanId` runs
   `syncMissingMonthEndJournals`, which reads the loan's two rates and generates
   any missing month-end Journal pair, oldest month first.
2. Entries are returned with a running balance computed on read as a cumulative
   `debit − credit` walk ordered by `entry_date` then `sequence_no`.
3. Adding a Payment or Receipt inserts the row, then cascades
   `recomputeMonthsFrom` over every Journal pair in that month or later.
4. Editing a Journal row's rate recomputes that row (and its paired TDS row for an
   interest edit) without touching other months or the loan.
5. Saving the rate panel writes both rates to the loan row.

## Error handling

- A `loanId` that does not exist: `getLoanRates` throws `NotFoundError` from
  `common/errors`, which the global error handler renders as a 404 in the standard
  envelope. (The module currently throws plain `Error`s, which surface as 500s;
  the new lookup uses the typed error because a missing loan is an expected,
  operational failure.)
- `syncMissingMonthEndJournals` keeps its silent `catch` — a failure there must
  never block a ledger read.
- Deleting a loan cascades its ledger rows.

## Migration

One generated Drizzle migration in `backend/src/db/migrations/`:

1. `DROP TABLE borrower_ledger_settings`
2. Truncate `borrower_ledger_entries`, drop `borrower_id` and its indexes, add
   `loan_id` with the FK and the four re-pointed indexes
3. `ALTER TABLE loans ADD COLUMN tds_rate_percent numeric(5,2) NOT NULL DEFAULT '10'`

Produced by `npm run db:generate`, applied with `npm run db:migrate`.

## Verification

The backend has no test runner (`npm test` is a stub), so verification is a
typecheck plus a manual pass:

- `npm run typecheck` in `backend/` and `frontend/`
- Select a loan, add a Payment and a Receipt, confirm the balance walk
- Confirm the month-end Journal Interest/TDS pair generates once and only once
- Backdate an entry before an existing Journal pair, confirm the cascade recompute
- Edit one Journal row's rate, confirm the loan master is unchanged
- Save the rate panel, confirm the loan master shows the new interest and TDS rate
- Edit the rate in the loan master, reload the ledger, confirm it picks up the change

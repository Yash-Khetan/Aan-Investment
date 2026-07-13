# Accounting (Journal Entries) Feature

Journal entries for disbursement, interest accrual, interest receipt,
principal receipt, penal interest and write-off (SRS §18). **Not to be
confused with** the existing `features/accounting/` module ("Accounting
Export" in the sidebar, route `/accounting`), which talks to a separate
`accounting-export` backend module producing flat CSV/XLSX rows — a
different feature built by someone else. This module is the actual
double-entry journal ledger, mounted at `/accounting-entries`.

## API

Mounted at `/accounting-entries`, wrapped in `{ success, data }`:

- `POST /accounting-entries/disbursement` — post a disbursement journal entry
- `POST /accounting-entries/write-off` — post a write-off journal entry
- `GET /accounting-entries/:loanId` — fetch the full ledger for a loan; each
  entry now includes its `lines` (the actual debit/credit legs — account
  code, account name, debit/credit amount, narration), so the ledger table's
  Debit/Credit Account and Amount columns are read directly from real data.

`INTEREST_ACCRUAL`, `INTEREST_RECEIPT`, and `PRINCIPAL_RECEIPT` entries are
only ever created as side effects of other modules (payment recording, and
an interest-accrual function with no route wired to it) — there is no direct
"record" endpoint for those three, so this page has no form for them; they
simply show up in the ledger table when present.

## Files

- `types.ts` — `JournalEntryType`, `JournalEntryLine`, `JournalEntry`,
  `RecordDisbursementInput`, `RecordWriteOffInput`
- `api.ts` — `recordDisbursement`, `recordWriteOff`, `getLedger`
- `AccountingLedgerPage.tsx` — loan picker + ledger table (debit/credit
  account and amount derived from each entry's `lines`) + "Record
  Disbursement" / "Record Write-Off" toggle forms
- `components/RecordJournalEntryForm.tsx` — shared form (both entry types take
  the same `{ loanId, amount, entryDate }` shape, so one parameterized
  component replaces two near-identical ones)

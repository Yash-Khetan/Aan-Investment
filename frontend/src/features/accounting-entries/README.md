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

- `POST /accounting-entries/write-off` — post a write-off journal entry
- `GET /accounting-entries/:loanId` — fetch the full ledger for a loan; each
  entry now includes its `lines` (the actual debit/credit legs — account
  code, account name, debit/credit amount, narration), so the ledger table's
  Debit/Credit Account and Amount columns are read directly from real data.

Disbursements are recorded via the separate `features/disbursements/` page
(`/disbursements`, backed by `POST /api/v1/loans/:loanId/disbursements`) —
that flow records the tranche and posts the matching `DISBURSEMENT` journal
entry automatically, so it shows up here in the ledger even though there's no
"Record Disbursement" form on this page anymore.

`INTEREST_ACCRUAL`, `INTEREST_RECEIPT`, and `PRINCIPAL_RECEIPT` entries are
only ever created as side effects of other modules (payment recording, and
an interest-accrual function with no route wired to it) — there is no direct
"record" endpoint for those three, so this page has no form for them; they
simply show up in the ledger table when present.

## Files

- `types.ts` — `JournalEntryType`, `JournalEntryLine`, `JournalEntry`,
  `RecordWriteOffInput`
- `api.ts` — `recordWriteOff`, `getLedger`
- `AccountingLedgerPage.tsx` — loan picker + ledger table (debit/credit
  account and amount derived from each entry's `lines`) + "Record Write-Off"
  toggle form
- `components/RecordJournalEntryForm.tsx` — form used by write-off recording
  (`{ loanId, amount, entryDate }` shape)

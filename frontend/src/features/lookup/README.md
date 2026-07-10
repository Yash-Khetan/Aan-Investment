# Lookup Feature

Not a page — a shared dependency used by Collateral, Collections, and Documents to
pick "which loan" or "which borrower" before showing that entity's data.

## Why this exists

None of the six backend modules return a loan/borrower **id** next to a
human-readable label anywhere. `reports`' loan-register returns `loanNumber` but
never the id; `dashboard` only returns aggregates. `collateral`, `collections`, and
`document-vault` all require a real UUID as input. Without a lookup source, no form in
this app could ever populate a valid `loanId`/`entityId`.

Two small read-only endpoints were added directly to the backend to close this gap —
see `backend/src/routes/lookup.routes.ts` and the backend README's "Known Quirks" /
lookup section:

- `GET /lookup/loans` → `{ id, loanAccountNumber, customerName, status, outstandingPrincipal }[]`
- `GET /lookup/borrowers` → `{ id, borrowerCode, name }[]`

## Files

- `types.ts` — `LoanLookup`, `BorrowerLookup`
- `api.ts` — `getLoanLookup`, `getBorrowerLookup`
- `hooks.ts` — `useLoanLookup`, `useBorrowerLookup` (react-query, `staleTime: 60s` since
  this data changes rarely within a session)
- `LoanSelect.tsx` / `BorrowerSelect.tsx` — `<select>` wrappers around the hooks above,
  used directly by the three feature pages that need an entity picker

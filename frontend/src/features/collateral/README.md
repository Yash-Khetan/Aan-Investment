# Collateral Feature

Security pledged against a loan — create, list, LTV recalculation, valuation updates,
insurance.

## API

All under `/collateral`, returning the resource directly (no `{ success, data }`
wrapper — unlike reports/accounting/dashboard):

- `POST /collateral` — create
- `GET /collateral/loan/:loanId` — list all collateral for a loan
- `GET /collateral/:id/ltv` — recalculate and return current LTV
- `PATCH /collateral/:id/valuation` — update estimated value
- `PATCH /collateral/:id/insurance` — create/update the linked insurance policy
- `DELETE /collateral/:id` — soft-delete

There is no "list all collateral" endpoint — everything is scoped to a loan, so this
page requires picking a loan first via `features/lookup/LoanSelect`.

## Files

- `types.ts` — `CollateralRecord`, `CreateCollateralInput`, `UpdateValuationInput`,
  `UpdateInsuranceInput`, `LtvResult`
- `api.ts` — one function per endpoint above
- `CollateralPage.tsx` — loan picker + collateral list + "Add Collateral" toggle
- `components/CreateCollateralForm.tsx` — the create form
- `components/CollateralRow.tsx` — one collateral record, with inline toggle forms for
  "Update Valuation" and "Update Insurance", plus a "Recalc LTV" button that fetches
  and displays the result inline (not persisted client-side — every click re-queries
  the backend's live LTV calculation)

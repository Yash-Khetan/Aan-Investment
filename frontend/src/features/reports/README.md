# Reports Feature

MIS reporting over the six report types the backend's `reports` module supports:
loan register, customer report, collateral report, collections report, document
report, portfolio summary.

## API

- `GET /reports/:report` → `{ success, report, generatedAt, count, data: T[] }`
- `GET /reports/export/:report?format=csv|xlsx&<filters>` → file download

`:report` is one of the six kebab-case names in `types.ts` (`REPORT_NAMES`).

### Filters

`loanStatus`, `customerId`, `startDate`, `endDate`, `collateralType` (collateral-report
only), `collectionStatus` (collections-report only). **`branchId` is deliberately never
sent** — the backend validator (`report-filters.validator.ts`) rejects it outright with
a 400 if present, since no `branches` table exists in the schema.

Column headers/types per report (currency vs. date vs. badge vs. plain text) are
hardcoded in `columns.ts` rather than inferred from the response, since each report
returns a different row shape and inference would be guesswork about which fields are
money vs. plain numbers.

## Files

- `types.ts` — report names/labels, filter shape, generic `ReportRow`
- `columns.ts` — per-report column definitions (key, header, render type)
- `api.ts` — `getReport()`, `exportReport()`
- `ReportsPage.tsx` — report picker + filter bar + table + CSV/Excel export buttons

# Reports Module

## 1. Purpose

The Reports module is a **read-only** reporting layer over the LMS database. It never
inserts, updates, or deletes any record — every endpoint runs `SELECT`-only Drizzle
queries and aggregates data for consumption by the frontend, either as JSON (for
in-app tables/dashboards) or as a downloadable CSV / Excel file.

It exposes six reports:

| Report | Endpoint | Source tables |
|---|---|---|
| Loan Register | `/reports/loan-register` | `loans`, `borrowers` |
| Customer Report | `/reports/customer-report` | `borrowers`, `loans` |
| Collateral Report | `/reports/collateral-report` | `collaterals`, `collateral_insurance`, `loans`, `borrowers` |
| Collections Report | `/reports/collections-report` | `collection_cases`, `follow_ups`, `loans`, `borrowers`, `users` |
| Document Report | `/reports/document-report` | `documents`, `users` |
| Portfolio Summary | `/reports/portfolio-summary` | `loans` (aggregate) |

## 2. Folder structure

```
reports/
  controllers/     Express route handlers (JSON + export), thin — delegate to services
  routes/           reportsRouter — mounts every GET endpoint + the module's error handler
  services/         One file per report (Drizzle queries) + reports.service.ts (ReportsService)
  middleware/       validateQuery (zod) and the module-local error handler
  validators/       zod schemas for filters and the export `format` param
  constants/        Report titles + CSV/Excel column definitions (order + labels)
  utils/            logger, ApiError, asyncHandler, date-range SQL helper, CSV/Excel builders
  types/            Shared TS types/interfaces for filters and report rows
  index.ts          Public API: `reportsRouter`, `ReportsService`
  README.md         This file
```

## 3. Wiring it into the app

`index.js` (the current bare Express entry point) does not yet mount any router. To
expose these endpoints, wire the router in wherever the app is assembled:

```ts
import { reportsRouter } from "./modules/reports";

app.use("/reports", reportsRouter);
```

All endpoints below are relative to wherever `reportsRouter` is mounted (assumed to
be `/reports` in this document).

## 4. Routes

### JSON endpoints

```
GET /reports/loan-register
GET /reports/customer-report
GET /reports/collateral-report
GET /reports/collections-report
GET /reports/document-report
GET /reports/portfolio-summary
```

### Export endpoints

```
GET /reports/export/loan-register?format=csv|xlsx|json
GET /reports/export/customer-report?format=csv|xlsx|json
GET /reports/export/collateral-report?format=csv|xlsx|json
GET /reports/export/collections-report?format=csv|xlsx|json
GET /reports/export/document-report?format=csv|xlsx|json
GET /reports/export/portfolio-summary?format=csv|xlsx|json
```

`format` defaults to `csv` if omitted. `xlsx` and `csv` return a file download
(`Content-Disposition: attachment`); `json` returns the same JSON shape as the
non-export endpoint (useful for testing export column selection without opening a
file).

## 5. Filters

All filters are optional query params, applied where they are semantically
meaningful to that report (see the per-report notes below). Unknown query params
are rejected with `400` (`.strict()` zod schemas), as are malformed values.

| Filter | Type | Notes |
|---|---|---|
| `loanStatus` | enum | One of `PENDING, ACTIVE, OVERDUE, NPA, CLOSED, WRITTEN_OFF` |
| `customerId` | UUID | Borrower id |
| `startDate` / `endDate` | `YYYY-MM-DD` | Inclusive range, applied to each report's `createdAt`. Max span: 5 years. `endDate` must be ≥ `startDate` |
| `collateralType` | enum | One of `PROPERTY, MORTGAGE, STRUCTURED_CREDIT, PERSONAL_GUARANTEE, CORPORATE_GUARANTEE, NONE` |
| `collectionStatus` | enum | One of `OPEN, PROMISE_TO_PAY, FOLLOW_UP, CLOSED` |
| `branchId` | — | **Always rejected with 400.** See "Known schema gaps" below. |

Per-report applicability:

- **Loan Register**: `loanStatus`, `customerId`, `startDate`/`endDate` (on `loans.createdAt`).
- **Customer Report**: `customerId` (which borrower), `loanStatus` + `startDate`/`endDate` scope *which of that customer's loans* count toward `totalLoans`/`outstandingAmount`.
- **Collateral Report**: `collateralType`, `loanStatus`, `customerId` (the loan's borrower), `startDate`/`endDate` (on `collaterals.createdAt`).
- **Collections Report**: `collectionStatus`, `loanStatus`, `customerId`, `startDate`/`endDate` (on `collection_cases.createdAt`).
- **Document Report**: `customerId` (matches documents where `ownerType = 'BORROWER'` and `ownerId = customerId`), `startDate`/`endDate` (on `documents.createdAt`). `loanStatus`/`collateralType`/`collectionStatus` are accepted but not applicable to documents.
- **Portfolio Summary**: `customerId`, `startDate`/`endDate` only — `loanStatus` is not applied here since the report's whole purpose is to break totals down *by* status.

## 6. Export formats

- **CSV** — via `json2csv` (`Parser`), column order/labels from `constants/report.constants.ts`. An empty report still returns a header-only CSV rather than an error.
- **Excel (.xlsx)** — via `ExcelJS`, one sheet named after the report, bold/shaded header row, auto-sized columns.
- **JSON** — same shape as the non-export endpoints.

## 7. Sample requests & responses (Postman)

### `GET /reports/loan-register?loanStatus=ACTIVE`

```json
{
  "success": true,
  "report": "loan-register",
  "generatedAt": "2026-07-09T10:32:44.015Z",
  "count": 1,
  "data": [
    {
      "loanNumber": "LN-2026-0001",
      "customerName": "Acme Textiles Pvt Ltd",
      "loanAmount": "1000000.00",
      "outstandingAmount": "800000.00",
      "interestRate": "12.5000",
      "status": "ACTIVE",
      "createdDate": "2026-01-15T09:30:00.000Z"
    }
  ]
}
```

### `GET /reports/customer-report`

```json
{
  "success": true,
  "report": "customer-report",
  "generatedAt": "2026-07-09T10:32:44.015Z",
  "count": 1,
  "data": [
    {
      "customerId": "3f2c9e10-7a3b-4c9a-9c2e-1a2b3c4d5e6f",
      "customerName": "Acme Textiles Pvt Ltd",
      "phone": "9876543210",
      "email": "accounts@acmetextiles.example",
      "totalLoans": 2,
      "outstandingAmount": "1220000.00"
    }
  ]
}
```

### `GET /reports/collateral-report?collateralType=PROPERTY`

```json
{
  "success": true,
  "report": "collateral-report",
  "generatedAt": "2026-07-09T10:32:44.015Z",
  "count": 1,
  "data": [
    {
      "collateralType": "PROPERTY",
      "loanNumber": "LN-2026-0001",
      "marketValue": "1500000.00",
      "forcedSaleValue": null,
      "ltv": "66.67",
      "insuranceStatus": "ACTIVE"
    }
  ]
}
```

### `GET /reports/collections-report?collectionStatus=FOLLOW_UP`

```json
{
  "success": true,
  "report": "collections-report",
  "generatedAt": "2026-07-09T10:32:44.015Z",
  "count": 1,
  "data": [
    {
      "loanNumber": "LN-2026-0004",
      "customerName": "Ravi Kumar",
      "collectionStatus": "FOLLOW_UP",
      "promiseToPay": null,
      "nextFollowUp": "2026-07-12",
      "assignedUser": "Priya Sharma"
    }
  ]
}
```

### `GET /reports/document-report`

```json
{
  "success": true,
  "report": "document-report",
  "generatedAt": "2026-07-09T10:32:44.015Z",
  "count": 1,
  "data": [
    {
      "documentName": "Sanction Letter",
      "entityType": "LOAN",
      "entityId": "9d1e2f3a-4b5c-6d7e-8f90-1a2b3c4d5e6f",
      "uploadedBy": "Priya Sharma",
      "uploadedAt": "2026-01-16T11:00:00.000Z",
      "fileType": "application/pdf"
    }
  ]
}
```

### `GET /reports/portfolio-summary`

```json
{
  "success": true,
  "report": "portfolio-summary",
  "generatedAt": "2026-07-09T10:32:44.015Z",
  "data": {
    "totalLoans": 6,
    "activeLoans": 1,
    "closedLoans": 1,
    "rejectedLoans": 0,
    "totalPortfolioValue": "4950000.00",
    "outstandingAmount": "3970000.00",
    "averageLoanSize": "825000.00",
    "averageInterestRate": "13.0000"
  }
}
```

### Error response shape (any 4xx/5xx)

```json
{
  "success": false,
  "error": "Invalid request filters: loanStatus: Invalid option: expected one of \"PENDING\"|\"ACTIVE\"|\"OVERDUE\"|\"NPA\"|\"CLOSED\"|\"WRITTEN_OFF\""
}
```

### `GET /reports/export/loan-register?format=xlsx`

Returns `200` with:
- `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `Content-Disposition: attachment; filename="loan-register-2026-07-09.xlsx"`
- Binary `.xlsx` body (open directly in Postman via "Save Response > Save to a file").

## 8. How the frontend should consume reports

- **In-app tables / dashboards**: call the JSON endpoints directly (e.g.
  `GET /reports/loan-register?loanStatus=ACTIVE`) and render `data`. Use `count` for
  pagination-free result sizing (these endpoints are not paginated — they are
  reporting endpoints, not list views).
- **Download buttons**: point an `<a href>` / `window.open` directly at an export URL,
  e.g. `/reports/export/loan-register?format=xlsx&loanStatus=ACTIVE`, so the browser
  handles the `Content-Disposition: attachment` response natively. No need to fetch
  and blob it client-side unless you need to show a loading spinner first.
- **Empty results**: a `200` with `count: 0` / `data: []` is a normal, valid response
  (no data matched the filters) — distinguish this from a `4xx`/`5xx` error response.
- **Numeric fields** (amounts, rates, LTV) are returned as **strings**, not JS numbers
  — they come from Postgres `numeric` columns and are kept as exact-precision strings
  to avoid floating-point rounding on money values. Parse with a decimal-safe method
  on the frontend before formatting for display.
- **`portfolio-summary`** returns a single `data` object, not an array — every other
  report returns `data: [...]` plus a `count`.

## 9. Known schema gaps (read before relying on these fields)

The spec for this module assumes a few fields/tables that do not exist in the
current Drizzle schema (`backend/src/db/schema`). Rather than inventing data or
silently dropping filters, these are handled explicitly:

- **`branchId` filter**: no `branches` table exists anywhere in the schema (loans/
  borrowers only carry `relationshipManagerId`). Passing `branchId` on **any**
  endpoint returns `400` with a clear message, rather than silently ignoring it or
  guessing that "branch" means "relationship manager." If a `branches` table is
  added later, wire the filter into each `services/*.service.ts` file and relax the
  validator's rejection in `validators/report-filters.validator.ts`.
- **`rejectedLoans` in Portfolio Summary**: `loan_status` has no `REJECTED` value
  (only `PENDING, ACTIVE, OVERDUE, NPA, CLOSED, WRITTEN_OFF`). The query is written
  to always evaluate to `0` for this field (via a safe `::text` cast so Postgres
  doesn't throw on the unknown enum literal) rather than mapping it onto an existing
  status that doesn't mean "rejected." Once the enum gains a `REJECTED` value, this
  starts working with no code change.
- **`forcedSaleValue` in Collateral Report**: there is no Forced Sale Value column on
  `collaterals` (only `estimated_value`, i.e. market value). This field is always
  `null` rather than estimating it via an invented haircut percentage.
- **`insuranceStatus` in Collateral Report**: derived, not stored — `NOT_INSURED` (no
  insurance record), `INACTIVE` (latest policy's `status = INACTIVE`), `EXPIRED`
  (`expiryDate` in the past), or `ACTIVE` otherwise.
- **`outstandingAmount`** (Loan Register, Customer Report, Portfolio Summary) reflects
  `loans.outstanding_principal`, the ledger's maintained running balance — not a
  live recomputation from `installments`/`payment_allocations`. If the Loans module
  does not keep this column in sync with payments, these figures will be stale. A
  more granular, always-accurate value can be derived per loan as
  `sum(installments.total_amount) - sum(installments.paid_total)` over the loan's
  current (`is_current = true`) `repayment_schedules` row, but that was not adopted
  here to avoid a much heavier join across `loan-register`/`customer-report`/
  `portfolio-summary` — worth revisiting once the Loans/Payments modules confirm
  whether they keep `outstanding_principal` synced.

## 10. Logging

Every report/export call logs a single structured JSON line (`console.log`/`warn`/
`error`) with the report name, row count, and execution time in milliseconds — never
row data, filter values that could carry PII (e.g. `customerId` is a UUID, safe to
log; nothing carrying names/phone/email is ever logged). See `utils/logger.util.ts`.

## 11. Type-checking

```
npm run typecheck   # tsc --noEmit
npm run build        # tsc -> dist/
```

This module (and the TypeScript toolchain it required — `tsconfig.json`, `typescript`,
`tsx`, `@types/node`, `@types/express`, `@types/json2csv`) was added as part of this
work since no TS build pipeline previously existed in `backend/`. `index.js` remains
the plain-JS runtime entry point referenced by the Dockerfile; wiring `reportsRouter`
into a real (TypeScript) app entry point is a follow-up outside this module's scope.

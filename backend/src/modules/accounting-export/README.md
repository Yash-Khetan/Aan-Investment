# Accounting Export Module

## Purpose

Generates standardized, accounting-friendly exports from the LMS so the numbers can be
imported into any external ERP or accounting system (Tally, Zoho Books, QuickBooks, SAP,
a custom GL, etc.). This module does **not** integrate with any accounting software
directly — it only produces structured data (JSON / CSV / XLSX) in a shape that's
easy for a downstream import job to consume.

The module is **strictly read-only**: every code path is a `SELECT`. It never inserts,
updates, or deletes rows.

## Folder Structure

```
accounting-export/
  controllers/    Express request handlers (list + export)
  routes/         Router wiring, mounted at /accounting by the app entry point
  services/       AccountingExportService — all Drizzle queries + format conversion
  middleware/     Request logging, centralized error handling
  validators/     Query-param validation (filters, export format)
  constants/      Category → transaction-type map, debit/credit account map, column defs
  utils/          Logger, typed HTTP errors, date/amount helpers, response helper
  exporters/      CSV (json2csv) and Excel (ExcelJS) generation
  types/          Shared TypeScript types (AccountingEntryRow, filters, etc.)
  index.ts        Public API: accountingExportRouter, AccountingExportService
  README.md       This file
```

## Routes

### List endpoints (JSON)

| Method | Path                          | Description                    |
|--------|-------------------------------|---------------------------------|
| GET    | `/accounting/principal`       | Principal received entries      |
| GET    | `/accounting/interest`        | Interest received entries       |
| GET    | `/accounting/penalties`       | Penalty charge entries          |
| GET    | `/accounting/disbursements`   | Loan disbursement entries       |
| GET    | `/accounting/closures`        | Loan closure entries            |
| GET    | `/accounting/write-offs`      | Loan write-off entries          |
| GET    | `/accounting/refunds`         | Refund entries (see note below) |

### Export endpoints (file download)

| Method | Path                                     |
|--------|-------------------------------------------|
| GET    | `/accounting/export/principal?format=`     |
| GET    | `/accounting/export/interest?format=`      |
| GET    | `/accounting/export/penalties?format=`     |
| GET    | `/accounting/export/disbursements?format=` |
| GET    | `/accounting/export/closures?format=`      |
| GET    | `/accounting/export/write-offs?format=`    |
| GET    | `/accounting/export/refunds?format=`       |

`format` accepts `json` (default response shape, same as the list endpoints),
`csv`, or `xlsx`. If omitted on an export endpoint, it defaults to `csv`.

## Supported Exports

- Principal Received
- Interest Received
- Penalty Charges
- Loan Disbursement
- Loan Closure
- Loan Write-Off
- Refunds

> **Processing Fees** and **EMI Payments** are not exposed as separate endpoints.
> An EMI payment is, by construction, the combination of a Principal Received row and
> an Interest Received row for the same `paymentRefNumber` — those two endpoints
> already cover it without duplicating data. Processing Fees has no dedicated column
> or table anywhere in the current schema (`loans`, `paymentAllocations`, etc.), so
> rather than fabricate a fee figure, no endpoint is exposed for it. Add a schema
> column/table for processing fees first, then wire a `getProcessingFeeEntries()`
> method the same way the other seven are built.

## Output Formats

- **JSON** — `{ success, count, generatedAt, filters, notes?, data: AccountingEntryRow[] }`
- **CSV** — generated with `json2csv`, one row per entry, headers matching the column list below
- **Excel (.xlsx)** — generated with `ExcelJS`, bold header row, autofilter, amount columns formatted as `#,##0.00`

## Accounting Entry Columns

Every row (in every format) has exactly these fields, in this order:

`Transaction Date, Loan Number, Customer Name, Transaction Type, Reference Number, Debit Account, Credit Account, Principal Amount, Interest Amount, Penalty Amount, Fees, Tax Amount, Total Amount, Remarks, Created At`

Debit/Credit account labels come from a fixed mapping in
[`constants/account-mapping.constants.ts`](./constants/account-mapping.constants.ts)
since the schema has no chart-of-accounts table yet. Update that file if your GL
account names differ.

## Filters

All filters are optional query parameters, supported on every list and export endpoint:

| Filter            | Type                 | Notes |
|--------------------|----------------------|-------|
| `loanId`           | UUID                 | Matches `loans.id` |
| `customerId`        | UUID                 | Matches `borrowers.id` (the schema calls borrowers, not "customers") |
| `transactionType`   | one of the 7 types    | If it doesn't match the endpoint's own category, the endpoint returns an empty result rather than an error |
| `startDate` / `endDate` | `YYYY-MM-DD`      | Inclusive date range on the entry's transaction date |
| `branchId`          | UUID                 | **Accepted but has no effect.** The schema has no `branches` table or `branchId` column anywhere. The response includes a `notes` field explaining this when the filter is supplied. |

## Known Schema Gaps

- **Refunds**: no `refunds` table exists. `getRefundEntries()` / `GET /accounting/refunds`
  and `GET /accounting/export/refunds` are fully wired but always return an empty result
  with an explanatory `notes` field, so downstream consumers get a stable, well-formed
  response rather than a 404 for an entire category.
- **branchId**: no branch concept exists in the schema. The filter is validated (must be
  a UUID if present) but does not narrow any query.
- **Tax Amount / Fees**: always `0` in the current data — there's no tax or fee column
  anywhere in the schema to source them from. The columns are still present in every
  export so downstream ERP import templates don't need to change shape once those
  columns are added later.

## Sample Requests (Postman)

```
GET http://localhost:3000/accounting/principal?startDate=2026-01-01&endDate=2026-06-30
GET http://localhost:3000/accounting/export/interest?format=xlsx&loanId=653e6f26-a5fc-4d80-b6eb-62de66097a25
GET http://localhost:3000/accounting/export/closures?format=csv
GET http://localhost:3000/accounting/write-offs
```

## Sample JSON Response

```json
{
  "success": true,
  "count": 1,
  "generatedAt": "2026-07-10T04:01:06.653Z",
  "filters": {},
  "data": [
    {
      "transactionDate": "2026-07-09",
      "loanNumber": "SEED-LN-CLOSED-001",
      "customerName": "Seed Borrower Two",
      "transactionType": "LOAN_CLOSURE",
      "referenceNumber": "SEED-LN-CLOSED-001-LOAN_CLOSURE",
      "debitAccount": "Loan Principal Receivable",
      "creditAccount": "Loan Closure Suspense Account",
      "principalAmount": 300000,
      "interestAmount": 0,
      "penaltyAmount": 0,
      "fees": 0,
      "taxAmount": 0,
      "totalAmount": 300000,
      "remarks": "",
      "createdAt": "2026-07-09T05:57:14.298Z"
    }
  ]
}
```

## Sample Error Response

```json
{
  "success": false,
  "error": {
    "code": "NO_DATA_FOUND",
    "message": "No Principal Received entries found for the given filters."
  }
}
```

Error codes: `VALIDATION_ERROR` (400), `NO_DATA_FOUND` (404, export endpoints only —
list endpoints return `200` with an empty `data` array), `DATABASE_ERROR` (502),
`INTERNAL_ERROR` (500).

## Example CSV

```csv
"Transaction Date","Loan Number","Customer Name","Transaction Type","Reference Number","Debit Account","Credit Account","Principal Amount","Interest Amount","Penalty Amount","Fees","Tax Amount","Total Amount","Remarks","Created At"
"2026-07-09","SEED-LN-CLOSED-001","Seed Borrower Two","LOAN_CLOSURE","SEED-LN-CLOSED-001-LOAN_CLOSURE","Loan Principal Receivable","Loan Closure Suspense Account",300000,0,0,0,0,300000,"","2026-07-09T05:57:14.298Z"
```

## Example Excel

`GET /accounting/export/closures?format=xlsx` returns an `.xlsx` workbook with:
- A single worksheet named after the category (e.g. "Loan Closure")
- A bold, shaded header row matching the column list above
- Amount columns (`Principal Amount` … `Total Amount`) formatted as `#,##0.00`
- Autofilter enabled on the header row

## How Future ERP Systems Can Consume These Exports

1. Poll or manually trigger `GET /accounting/export/:category?format=csv` (or `xlsx`)
   on a schedule, filtered by `startDate`/`endDate` for the accounting period being closed.
2. Import the file directly — every row is already a balanced double-entry line
   (`Debit Account` / `Credit Account` / `Total Amount`), so no transformation should
   be required beyond mapping the account label strings to the ERP's own chart of
   accounts codes if they differ from the defaults in `account-mapping.constants.ts`.
3. Use `Reference Number` as the idempotency key when importing — re-running the same
   export for an overlapping date range is safe as long as the ERP treats
   `Reference Number` as unique per entry.
4. For programmatic/API-based ERP integrations instead of file import, call the JSON
   list endpoints (`format=json` or the plain `GET /accounting/:category` routes) and
   read `data` directly — the shape is identical to the CSV/XLSX columns.

## Logging

Every request logs an "Export requested" line on entry and an "Export request completed"
line (with status code and duration in ms) on completion; "Export generated" is logged
once the row set has been fetched, including the row count. No borrower PII (name, PAN,
phone, address) or raw query results are ever logged — only route, category, format,
row counts, and timing.

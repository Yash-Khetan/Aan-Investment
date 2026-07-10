# Accounting Export Feature

Standardized double-entry accounting rows across seven categories: principal,
interest, penalties, disbursements, closures, write-offs, refunds.

## API

- `GET /accounting/:category` → `{ success, count, generatedAt, filters, notes?, data: AccountingEntryRow[] }`
- `GET /accounting/export/:category?format=csv|xlsx&<filters>` → file download

`:category` is one of the seven values in `types.ts` (`ACCOUNTING_CATEGORIES`).

### Filters

`loanId` (UUID), `customerId` (UUID), `startDate`, `endDate`. `branchId` is not
exposed in this UI at all — the backend accepts it but silently no-ops it (unlike
`reports`, which rejects it with a 400); see the accounting-export module's own
backend README for why.

### The `refunds` category

Always returns an empty result with a `notes` field explaining that no `refunds` table
exists in the schema yet. This page renders that `notes` string in an amber banner
above the table whenever the backend sends one — it's not an error, just a heads-up.

## Files

- `types.ts` — categories, labels, `AccountingEntryRow` (all 15 fixed columns), filters
- `api.ts` — `getAccountingEntries()`, `exportAccountingEntries()`
- `AccountingPage.tsx` — category picker + date/loan filters + fixed-column table
  (unlike Reports, every category returns the exact same 15 columns, so this page uses
  one static column list rather than a per-category map)

# Dashboard Module

Read-only aggregate endpoints for the internal portfolio/collections dashboard. No writes, no auth (yet) — see [Auth](#auth) below.

## Endpoints

Base path: `/api/dashboard`

### `GET /api/dashboard/summary`

Combined response: `{ portfolio, collections }` (see shapes below).

### `GET /api/dashboard/portfolio`

Loan portfolio breakdown by status.

```json
{
  "totals": {
    "totalLoans": 5,
    "totalSanctioned": 3950000,
    "totalDisbursed": 3800000,
    "totalOutstanding": 3220000
  },
  "byStatus": [
    {
      "status": "ACTIVE",
      "loanCount": 1,
      "sanctionedAmount": 1000000,
      "disbursedAmount": 1000000,
      "outstandingPrincipal": 800000
    }
  ]
}
```

- Sourced from `loans`, grouped by `status` (`PENDING | ACTIVE | OVERDUE | NPA | CLOSED | WRITTEN_OFF`).
- Soft-deleted loans (`deletedAt IS NOT NULL`) are excluded.

### `GET /api/dashboard/collections`

Collections/recovery KPIs.

```json
{
  "openCases": 2,
  "totalOverdueAmount": 2139400,
  "byStatus": [
    { "status": "OPEN", "caseCount": 1, "overdueAmount": 2000000 }
  ],
  "upcomingFollowUps": 2,
  "overdueInstallments": {
    "count": 2,
    "totalAmount": 79400
  }
}
```

- `byStatus` / `openCases` / `totalOverdueAmount` are sourced from `collection_cases` (open = any status except `CLOSED`).
- `upcomingFollowUps` counts non-closed collection cases with `nextFollowUpDate` in the next 7 days.
- `overdueInstallments` is computed directly from `installments` (`status IN (PENDING, PARTIAL)` and `dueDate` in the past), independent of whether a collection case has been opened yet — a useful cross-check against `byStatus`.

## Auth

Not wired up yet. These routes are open. RBAC/JWT will need to gate this behind at least `VIEWER`-level access before this ships.

## Local development data

The database starts empty, so `src/server.ts` seeds a fixed set of dashboard test data (2 borrowers, 5 loans — one per status, installments including overdue ones, 3 collection cases) on startup and deletes exactly those rows on shutdown (`Ctrl+C` / `SIGINT`/`SIGTERM`). See `src/db/seed/dashboardSeed.ts`. This is temporary scaffolding for exercising these endpoints before real data entry flows exist — remove it once borrower/loan creation APIs are in place.

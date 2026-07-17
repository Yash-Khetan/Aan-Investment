# Dashboard Feature

Read-only portfolio + collections overview. Single page, single request.

## API

`GET /dashboard/summary` → `{ portfolio: PortfolioSummary, collections: CollectionsSummary }`
(raw JSON, no `{ success, data }` wrapper — see `types.ts` for the exact shape).

No filters, no pagination — the backend endpoint itself takes none.

## Files

- `types.ts` — mirrors `backend/src/modules/dashboard/dashboard.service.ts`'s return shape
- `api.ts` — one function, `getDashboardSummary()`
- `DashboardPage.tsx` — stat cards for portfolio totals, a status breakdown with inline
  CSS bar-width visualization (no charting library dependency), and a collections
  summary section

## Notes

The backend's own README documents this endpoint's base path as `/api/dashboard`,
which is stale — the real mount is `/dashboard` (see backend README, "Known Quirks").
This app calls the real path.

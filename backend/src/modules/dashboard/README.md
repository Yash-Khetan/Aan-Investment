# Dashboard

Read-only portfolio overview. Mounted at `/dashboard`; every route requires authentication.

| Route | Returns |
|---|---|
| `GET /dashboard/summary` | `{ portfolio, returns, scheduled }` |
| `GET /dashboard/portfolio` | `portfolio` only |

## Where the figures come from

Every money figure is summed from each live loan's **ledger snapshot**
(`modules/ledger/snapshot.ts`), the same figures the Loans list shows per loan, so the
dashboard always adds up to the list.

- `portfolio.totals`: loan count, sanctioned (the loan rows), and from the snapshots
  disbursed, received, principal outstanding, interest due, total payable, amount
  overdue, and the count of loans with DPD above zero.
- `portfolio.byClassification`: loan count, principal outstanding and amount overdue per
  DPD classification (STD, SMA-0, SMA-1, SMA-2, NPA). All five are always present.
- `returns`: portfolio XIRR over every loan's ledger cash flows (`loan/loan.irr.ts`), and
  MIRR at the disbursement-weighted average interest rate.
- `scheduled`: every disbursement and receipt dated after today on a live loan, soonest
  first, with counts and totals for the next 7 days, the next 30 days and overall. These
  are counted in no other figure until their date arrives (every snapshot is as at today).

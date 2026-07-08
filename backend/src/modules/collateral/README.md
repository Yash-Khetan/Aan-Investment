# Collateral Management

A generic, reusable module for tracking every security pledged against a
loan — property, land, vehicles, gold, machinery, guarantees, and so on.
It records collateral details, valuations, LTV, and insurance. It does
**not** decide whether a loan should be approved, sanctioned, or disbursed
— that is loan-module territory. This module only answers "what security
exists against this loan, and what is it worth?"

## Purpose

- Loans reference one or more collaterals via `loanId`.
- Each collateral carries a valuation (`estimatedValue`, `valuationDate`)
  and a computed Loan-to-Value ratio.
- Insurance details for a collateral are tracked separately and updated
  independently of the collateral's core fields.
- No underwriting, approval, or disbursement logic lives here — only
  collateral bookkeeping.

## Folder structure

```
collateral/
  controllers/    Express request handlers — thin, delegate to CollateralService
  routes/         collateralRouter — mounts controllers onto HTTP paths
  services/       CollateralService — all business logic; Drizzle used directly (no repositories)
  middleware/     Route-param validation (UUID checks) run before controllers
  validators/     Input assertions (type, amounts, dates, required fields)
  types/          TypeScript interfaces, no `any`
  utils/          LTV calculation, date helpers, status helpers, logging, error mapping
  constants/      Default status, LTV rounding precision, survey-number type list
  index.ts        Public API — the only thing other modules should import
```

## Schema note — read before assuming field names

This module works directly against the existing `collaterals` and
`collateral_insurance` tables (`db/schema/collateral.ts`) and does **not**
modify the schema. Two things worth knowing before wiring up a frontend:

- **Collateral type** is bound to the `security_type` Postgres enum:
  `PROPERTY`, `MORTGAGE`, `STRUCTURED_CREDIT`, `PERSONAL_GUARANTEE`,
  `CORPORATE_GUARANTEE`, `NONE`. There is no `VEHICLE` / `LAND` / `GOLD` /
  `FIXED_DEPOSIT` / `MACHINERY` value in the current schema — adding one
  requires a migration on that enum, which is out of scope for this module.
  `CollateralType` (in `types/collateral.types.ts`) is sourced directly
  from the enum so it can never silently drift out of sync.
- **Insurance is a separate table** (`collateral_insurance`), not flat
  columns on `collaterals`. `CollateralService.updateInsurance()` upserts
  the single "current" insurance row for a collateral (creates one if none
  exists yet, otherwise updates it in place). `getCollateral()` and
  `getLoanCollaterals()` both return the current insurance nested under
  `insurance`.
- There is no `createdBy` column on `collaterals`. The closest analogue is
  `valuationBy` (free-text, who performed the valuation) — pass it through
  `createCollateral` / `updateValuation` if you want to track that.
- `marketValue` / `forcedSaleValue` as distinct fields don't exist —
  `estimatedValue` is the single valuation field, and LTV is computed
  against it.

## Business logic (`CollateralService`)

| Method | Behavior |
|---|---|
| `createCollateral(input)` | Validates input, confirms the loan exists, blocks duplicate `PROPERTY` collateral for the same loan+surveyNumber, auto-computes LTV against the loan's `outstandingPrincipal` if possible, inserts the row. |
| `updateCollateral(id, input)` | Validates provided fields, recomputes LTV if `estimatedValue` changes, updates only the fields supplied. |
| `deleteCollateral(id)` | Soft-deletes (`deletedAt` + `status: INACTIVE`) — never a hard delete. |
| `getCollateral(id)` | Returns the collateral with its current insurance nested. |
| `getLoanCollaterals(loanId)` | Confirms the loan exists, returns every active collateral for it with insurance nested. |
| `updateValuation(id, input)` | Updates `estimatedValue` / `valuationDate` / `valuationBy` and recomputes LTV. |
| `updateInsurance(id, input)` | Upserts the current insurance record for the collateral. |
| `calculateLTV(id)` | Recomputes and persists LTV on demand; throws if no valuation exists yet. |

## LTV calculation

```
LTV % = Loan Outstanding (loans.outstandingPrincipal) / Market Value (estimatedValue) * 100
```

Rounded to 2 decimal places (`utils/ltv.util.ts`, `LTV_DECIMAL_PLACES`).
Computed automatically whenever a collateral is created or its valuation
changes; also available on demand via `CollateralService.calculateLTV(id)`.
If the market value is zero, missing, or negative, LTV cannot be computed
— `create`/`update` simply store no LTV in that case, while an explicit
`calculateLTV()` call throws `LtvCalculationError`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST   | `/collateral` | Create a collateral |
| GET    | `/collateral/loan/:loanId` | List all collateral for a loan |
| GET    | `/collateral/:id/ltv` | Recalculate and return LTV for a collateral |
| PATCH  | `/collateral/:id/valuation` | Update valuation (recomputes LTV) |
| PATCH  | `/collateral/:id/insurance` | Create/update insurance details |
| GET    | `/collateral/:id` | Get a collateral by id |
| PUT    | `/collateral/:id` | Update a collateral |
| DELETE | `/collateral/:id` | Soft-delete a collateral |

All `:id` / `:loanId` route params are validated as UUIDs by
`middleware/params.middleware.ts` before reaching a controller.

## How the Loan module consumes this

```ts
import { CollateralService } from "../collateral";

// Registering a property against a loan at disbursement time
const collateral = await CollateralService.createCollateral({
    loanId: loan.id,
    securityType: "PROPERTY",
    propertyAddress: "Plot 12, Sector 9, Gurugram",
    surveyNumber: "SEC9-PLOT12",
    estimatedValue: 5_000_000,
    valuationDate: "2026-07-01",
    valuationBy: "ABC Valuers Pvt Ltd",
});

// Loan module checking collateral cover before allowing further disbursement
const { ltvPercentage } = await CollateralService.calculateLTV(collateral.id);
if (ltvPercentage > 75) {
    // loan module's own decision — this module only reports the number
}

// Listing everything pledged against a loan
const pledged = await CollateralService.getLoanCollaterals(loan.id);
```

Mounting the routes in the app entry point:

```ts
import { collateralRouter } from "./modules/collateral";

app.use("/collateral", collateralRouter);
```

## Error handling

All failures are instances of `CollateralError` subclasses
(`CollateralNotFoundError`, `LoanNotFoundError`, `InvalidCollateralTypeError`,
`ValidationError`, `DuplicateCollateralError`, `LtvCalculationError`,
`CollateralPersistenceError`), mapped to HTTP status codes by
`utils/http-error-mapper.ts`. Consumers calling `CollateralService` directly
(not through HTTP) can catch `CollateralError` generically or a specific
subclass.

## Logging

`utils/logger.ts` logs the action (`CREATE`, `UPDATE`, `DELETE`, `GET`,
`LIST`, `VALUATION_UPDATE`, `INSURANCE_UPDATE`, `LTV_CALCULATED`), the
relevant id, and outcome — never raw request bodies, row contents, or
secrets.

## What this module intentionally does not do

- No loan approval, sanctioning, or disbursement logic.
- No document storage — collateral-related documents (title deeds,
  valuation reports) belong in the document-vault module, keyed by
  `entityType: "PROPERTY"` / the collateral's id.
- No repositories/DAOs — Drizzle is used directly inside `CollateralService`.
- No authentication/authorization — that's the consuming app's job. Route
  handlers accept whatever identity fields (e.g. `valuationBy`) the caller
  supplies; wire them to `req.user` once auth middleware exists upstream.

# Repayment Engine Feature

Generate and review the repayment schedule for a loan (SRS §9–10: EMI, bullet,
interest-only, moratorium, structured/customized schedules; every regeneration
is a new versioned revision, old ones kept for audit).

**Nothing is entered manually anymore.** Principal, rate, interest basis,
calculation method, tenure, and repayment type are all pulled from the loan
and its current Interest Engine config — `GenerateScheduleForm.tsx` just
previews those values and confirms. See `backend/src/modules/repayment/repayment.service.ts`'s
`buildScheduleInput` for exactly how each field is derived (e.g. principal =
`disbursedAmount` if any has gone out, else `sanctionedAmount`; tenure = months
between `firstDisbursementDate` and `maturityDate`).

Each installment's interest is computed via the loan's actual configured
Interest Engine basis/method (not a fixed compounding formula) — see
`interest.service.ts`'s `calculatePeriodInterest`, shared between the Interest
Engine's own calculate preview and this module's schedule generation.
`RUNNING_BALANCE` prices each installment's interest on that period's
declining scheduled balance; `SIMPLE_INTEREST` always prices it on the
original principal. For EMI, this means the interest portion (and so the
total installment amount) can vary slightly period to period instead of being
a single constant figure — principal is still split evenly across
installments, only the interest math reflects the real configured basis.

## Auto-regeneration

Whenever a loan's details change (`PUT /api/v1/loans/:id`) or its interest
config changes (`POST /interest-rules`), the schedule is automatically kept
in sync — see `repayment.service.ts`'s `syncRepaymentSchedule`:
- No schedule yet → generates the first one.
- Schedule exists, inputs changed, **no payments recorded yet** → silently
  regenerates a fresh version.
- Schedule exists, inputs changed, **payments already exist** → left alone
  (regenerating would orphan those payment-to-installment links). `GET
  /repayment-schedules/:loanId` returns `isStale: true` in this case, and
  `RepaymentEnginePage.tsx` shows a warning banner with a "Regenerate Now"
  button for the operator to confirm explicitly.

## API

Mounted at `/repayment-schedules`, wrapped in `{ success, data }`:

- `POST /repayment-schedules` — generate + save a new schedule revision for a
  loan, entirely from the loan + its interest config (body is just
  `{ loanId, remarks? }`). Server auto-increments `version`, marks it
  `isCurrent`, keeps the previous one for audit. Response is the schedule
  header only — no installments.
- `GET /repayment-schedules/:loanId` — fetch `{ schedule, installments,
  isStale }` for the current version (404 if none generated yet)

## Known backend gap

`repaymentType` accepts `CUSTOM` in the schema, but no strategy is registered
for it server-side — a loan with `repaymentType: CUSTOM` would throw an
unhandled 500 on generation, not a clean validation error. Since repayment
type is now read directly from the loan rather than chosen in this form,
there's no UI-level way to prevent this anymore — worth flagging if any loan
ever gets set to `CUSTOM`.

## Files

- `types.ts` — `RepaymentType`, `RepaymentSchedule`, `Installment` (now
  includes `outstandingBalance`), `ScheduleWithInstallments` (now includes
  `isStale`), `GenerateScheduleInput` (now just `{ loanId, remarks? }`)
- `api.ts` — `generateSchedule`, `getSchedule`
- `RepaymentEnginePage.tsx` — loan picker + staleness banner + schedule
  summary + installments table (with the new Outstanding Balance column) +
  "Generate Schedule" toggle form
- `components/GenerateScheduleForm.tsx` — read-only preview of the loan's
  derived generation inputs + a confirm button (fetches the loan via
  `features/loans/api.ts` and the interest config via `features/interest/api.ts`)

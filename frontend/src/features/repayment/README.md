# Repayment Engine Feature

Generate and review the repayment schedule for a loan (SRS §9–10: EMI, bullet,
interest-only, moratorium, structured/customized schedules; every regeneration
is a new versioned revision, old ones kept for audit).

## API

Mounted at `/repayment-schedules`, wrapped in `{ success, data }`:

- `POST /repayment-schedules` — generate + save a new schedule revision for a
  loan (server auto-increments `version`, marks it `isCurrent`, keeps the
  previous one for audit). Response is the schedule header only — no
  installments.
- `GET /repayment-schedules/:loanId` — fetch `{ schedule, installments }` for
  the current version (404 if none generated yet)

## Known backend gap

`repaymentType` accepts `CUSTOM` in the schema, but no strategy is registered
for it server-side — selecting it throws an unhandled 500, not a clean
validation error. **`CUSTOM` is deliberately omitted from this form's
dropdown** (see `types.ts` `REPAYMENT_TYPE_OPTIONS`) until the backend
implements it.

## Files

- `types.ts` — `RepaymentType`, `RepaymentSchedule`, `Installment`,
  `ScheduleWithInstallments`, `GenerateScheduleInput`
- `api.ts` — `generateSchedule`, `getSchedule`
- `RepaymentEnginePage.tsx` — loan picker + schedule summary + installments
  table + "Generate Schedule" toggle form
- `components/GenerateScheduleForm.tsx` — the generate form

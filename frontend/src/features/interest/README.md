# Interest Engine Feature

Configure the interest calculation method for a loan (SRS §5–8: flexible basis,
step-up/step-down rules, event-based triggers, penal interest) and preview a
calculation.

## API

Mounted at `/interest-rules`, wrapped in `{ success, data }`:

- `POST /interest-rules` — create a new config revision for a loan (server
  marks it `isCurrent` and supersedes the previous one)
- `GET /interest-rules/:loanId` — fetch the current config (404 if none set)
- `POST /interest-rules/:loanId/calculate` — run the full calculation
  (base interest + rate resolution + penal interest) as of a given date
- `POST /interest-rules/rules` — add a step-up/step-down/event-based slab tied
  to an `interestConfigId`
- `DELETE /interest-rules/rules/:ruleId` — remove a slab rule
- `GET /interest-rules/rules/:configId` — list slab rules for a config
- `POST /interest-rules/penal-rules` — set the penal interest rule for a loan
  (server marks it `isCurrent` and supersedes the previous one)
- `GET /interest-rules/penal-rules/:loanId` — list penal rules for a loan
  (current + history)

`customFormula` is only sent when `interestBasis === "CUSTOM"` — the backend
rejects `CUSTOM` without it (422 on the `customFormula` field).

`/calculate` also accepts an `installments` array (for time-slab rate
resolution) which this UI always sends as `[]` (a valid default) rather than
building an installment picker — wiring it to the Repayment Engine's
installment list would be a natural follow-up.

## Interest basis, opening/closing days, and calculation method

- **`THIRTY_360` and `MONTHLY` are retired** from this form's dropdown — the
  backend still accepts them (so any pre-existing config keeps calculating
  exactly as before), they're just no longer offered for new configs.
- **`MONTHLY_RATE_ACTUAL_30`** (new) — `(annualRate / 12) × (actualDays / 30) ×
  principal`, the standard NBFC convention for monthly-rate-quoted lending.
- **Include Opening & Closing Days** (Yes/No) — applies globally to every
  days-based basis. "Yes" makes day-count inclusive of both the period's
  start and end date (+1 day vs the default exclusive-of-one-endpoint count).
- **Method**:
  - **Simple Interest Method** (default) — the existing single-point formula,
    but based on the loan's *original* principal (`disbursedAmount`, never
    reduced by repayments) rather than a caller-supplied current outstanding
    figure.
  - **Running Balance Method** — walks day by day from the config's
    `effectiveFrom` to the `asOfDate`, deriving each day's real outstanding
    balance from the loan's principal ledger (disbursement tranches +
    principal repayments) and accruing `balance × dailyRate` per day. Not
    supported for `FULL_MONTH`/`CUSTOM` bases (no daily-rate concept for
    either) — the form hides those two basis options once Running Balance is
    selected, and the backend rejects the combination as a 422 if it's
    somehow submitted anyway.

## Files

- `types.ts` — `InterestBasis`, `InterestRuleType`, `CalculationMethod`,
  `InterestConfig`, `CreateInterestConfigInput`, `CalculateInterestInput/Result`,
  `InterestRule`, `CreateInterestRuleInput`, `PenalType`, `PenalBase`,
  `PenalInterestRule`, `CreatePenalRuleInput`
- `api.ts` — `createInterestConfig`, `getInterestConfig`, `calculateInterest`,
  `createInterestRule`, `deleteInterestRule`, `listInterestRules`,
  `createPenalRule`, `listPenalRules`
- `InterestSetup.tsx` — embedded in the loan creation flow: current config
  card + "Replace Config" toggle form + rules panel + penal rule panel +
  calculate panel
- `components/CreateInterestConfigForm.tsx` — the create form (basis, rule
  type, method, opening/closing days, custom formula when applicable)
- `components/CalculateInterestPanel.tsx` — calculation inputs + result display
- `components/InterestRulesPanel.tsx` — list/add/remove step-up/step-down/
  event slab rules for the current config, backed by the list endpoint
- `components/PenalRulesPanel.tsx` — shows the loan's current penal rule +
  history, and a form to set a new one (superseding the current)

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

## Files

- `types.ts` — `InterestBasis`, `InterestRuleType`, `InterestConfig`,
  `CreateInterestConfigInput`, `CalculateInterestInput/Result`,
  `InterestRule`, `CreateInterestRuleInput`, `PenalType`, `PenalBase`,
  `PenalInterestRule`, `CreatePenalRuleInput`
- `api.ts` — `createInterestConfig`, `getInterestConfig`, `calculateInterest`,
  `createInterestRule`, `deleteInterestRule`, `listInterestRules`,
  `createPenalRule`, `listPenalRules`
- `InterestEnginePage.tsx` — loan picker + current config card + "Set Interest
  Config" toggle form + rules panel + penal rule panel + calculate panel
- `components/CreateInterestConfigForm.tsx` — the create form
- `components/CalculateInterestPanel.tsx` — calculation inputs + result display
- `components/InterestRulesPanel.tsx` — list/add/remove step-up/step-down/
  event slab rules for the current config, backed by the list endpoint
- `components/PenalRulesPanel.tsx` — shows the loan's current penal rule +
  history, and a form to set a new one (superseding the current)

# Collections Feature

Recovery activity trail per loan — calls, reminders, visits, legal notices, and the
Promise to Pay lifecycle.

## API

All under `/collections`, returning the resource directly (no wrapper):

- `POST /collections` — log an activity. If the loan has no open collection case yet,
  the backend creates one automatically — this page never creates a case explicitly.
- `GET /collections/loan/:loanId` — list all activity for a loan
- `POST /collections/:id/promise-to-pay` — attach a Promise to Pay to an activity
  (`:id` is the **activity id**, not the loan id)
- `PATCH /collections/:id/promise-to-pay/close` — close it with `{ kept: boolean }`

There is no "list all activity across all loans" endpoint — this page requires picking
a loan first via `features/lookup/LoanSelect`.

## Files

- `types.ts` — `ACTIVITY_TYPES` (10 values), `COLLECTION_STATUSES`,
  `CollectionActivityRecord`, `CreateActivityInput`
- `api.ts` — `getLoanActivities`, `createActivity`, `updateStatus`,
  `createPromiseToPay`, `closePromiseToPay`
- `CollectionsPage.tsx` — loan picker + activity feed (newest first) + "Log Activity"
  toggle
- `components/LogActivityForm.tsx` — activity type + contact/remarks + optional
  Promise to Pay fields (shown automatically when activity type is
  `PROMISE_TO_PAY_CREATED`, though the backend accepts promise fields regardless of
  activity type)
- `components/ActivityRow.tsx` — renders one activity; if it has an open (unresolved)
  promise, shows "Mark Kept" / "Mark Broken" buttons that call `closePromiseToPay`

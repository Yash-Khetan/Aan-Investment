# Collections (Recovery)

A generic, reusable module for tracking loan recovery activity after
disbursement — calls, reminders, branch/field visits, Promises to Pay,
legal notices, settlement discussions — and maintaining the complete
history of that activity per loan and per customer. It does **not**
schedule anything, send anything, or decide legal/write-off action —
that is scheduler/notification/legal-module territory. This module only
answers "what has been done to recover this loan, and what's the current
state?"

## Purpose

- Every loan can have many collection activities over time; this module
  keeps the complete, append-friendly history.
- Each loan is backed by exactly one active **collection case**, created
  automatically the first time an activity is logged against it. The case
  carries the loan's current recovery `status`, `assignedTo` (collections
  officer), and `nextFollowUpDate`.
- No underwriting, disbursement, or scheduling logic lives here — only
  collections bookkeeping.

## Folder structure

```
collections/
  controllers/    Express request handlers — thin, delegate to CollectionsService
  routes/         collectionsRouter — mounts controllers onto HTTP paths
  services/       CollectionsService — all business logic; Drizzle used directly (no repositories)
  middleware/     Route-param validation (UUID checks) run before controllers
  validators/     Input assertions (type, amounts, dates, required fields)
  types/          TypeScript interfaces, no `any`
  utils/          Date helpers, status helpers, logging, error mapping
  constants/      Activity-type list, default status
  index.ts        Public API — the only thing other modules should import
```

## Schema note — read before assuming field names

This module works directly against the existing `collection_cases` and
`follow_ups` tables (`db/schema/collection.ts`) and does **not** modify
the schema. The illustrative field list/status list used to spec this
module doesn't exactly match what's in `feat/db`; the schema wins. Four
things worth knowing before wiring up a frontend:

- **There is no single flat "collection activity" table.** The schema has
  two related tables: `collection_cases` (one per loan — status, assignee,
  next follow-up date) and `follow_ups` (many per case — the actual
  history entries this module exposes as "collection activities"). A
  `CollectionActivityRecord` returned by this API is a `follow_ups` row
  enriched with `loanId` / `borrowerId` / `status` / `assignedTo` read
  from its parent case. The case itself is never exposed by its own id —
  you only ever address activities by their own id, or a loan/customer by
  theirs.
- **Status is bound to the `collection_status` Postgres enum**: `OPEN`,
  `PROMISE_TO_PAY`, `FOLLOW_UP`, `CLOSED`. There is no `PENDING`,
  `CONTACTED`, `PARTIALLY_PAID`, `PAID`, `LEGAL`, `SETTLED`, or
  `WRITE_OFF` value in the current schema — adding one requires a
  migration on that enum, which is out of scope for this module.
  `CollectionStatus` (in `types/collections.types.ts`) is sourced directly
  from the enum so it can never silently drift out of sync.
- **"Customer" is the `borrowers` table.** There's no separate `customers`
  table, so `customerId` in the route path (`/collections/customer/:customerId`)
  and `borrowerId` in the request/response bodies refer to the same thing
  — a row in `borrowers`.
- **`activityType`** (e.g. `CALL`, `REMINDER_SENT`, `PROMISE_TO_PAY_CREATED`
  — see `constants/collections.constants.ts` for the full list) maps to
  the `follow_ups.follow_up_type` column, which is a plain `varchar(50)`
  in the schema, not a Postgres enum. The allowed values are enforced by
  this module, not the database.
- **`notes`** isn't a separate column — it's an alias for `remarks`
  accepted on create/update for convenience; whichever one you pass wins
  (if both are supplied, `remarks` takes precedence).

## Business logic (`CollectionsService`)

| Method | Behavior |
|---|---|
| `createActivity(input)` | Validates input, confirms the loan exists, gets-or-creates the loan's collection case, inserts a `follow_ups` row. `followUpDate` defaults to today if omitted. Passing `status`/`assignedTo` updates the case. |
| `updateActivity(id, input)` | Updates only the fields supplied on the activity (and the case's `assignedTo`, if supplied). |
| `deleteActivity(id)` | Soft-deletes (`deletedAt`) — never a hard delete. |
| `getActivity(id)` | Returns a single activity. |
| `getLoanActivities(loanId)` | Confirms the loan exists, returns every activity for its case, newest first. |
| `getCustomerActivities(borrowerId)` | Confirms the customer exists, returns every activity across all of that customer's loans, newest first. |
| `updateStatus(id, input)` | Updates the recovery status on the activity's parent case. |
| `updateFollowUp(id, input)` | Updates the activity's `followUpDate` and the case's `nextFollowUpDate` together. |
| `createPromiseToPay(id, input)` | Records `promiseDate`/`promiseAmount` on an existing activity and moves the case to `PROMISE_TO_PAY`. |
| `closePromiseToPay(id, input)` | Marks the promise `kept: true/false`; moves the case to `CLOSED` (kept) or `FOLLOW_UP` (broken). Throws if the activity never had a promise, or it's already closed. |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST   | `/collections` | Create a collection activity |
| GET    | `/collections/loan/:loanId` | List all activities for a loan |
| GET    | `/collections/customer/:customerId` | List all activities for a customer |
| PATCH  | `/collections/:id/status` | Update the collection status |
| PATCH  | `/collections/:id/follow-up` | Update the next follow-up date |
| POST   | `/collections/:id/promise-to-pay` | Record a Promise to Pay on an activity |
| PATCH  | `/collections/:id/promise-to-pay/close` | Close a Promise to Pay (kept/broken) |
| GET    | `/collections/:id` | Get an activity by id |
| PUT    | `/collections/:id` | Update an activity |
| DELETE | `/collections/:id` | Soft-delete an activity |

All `:id` / `:loanId` / `:customerId` route params are validated as UUIDs
by `middleware/params.middleware.ts` before reaching a controller.

## Postman testing

Run the module standalone against the real database:

```
npx tsx src/modules/collections/index.ts
```

This seeds one throwaway test loan (and borrower), prints every endpoint
and a ready-to-use sample request body with real ids, and cleans the
seeded data up on `Ctrl+C`. Point Postman at `http://localhost:4000`.

Copy the `loanId` and `borrowerId` the console prints and substitute them
for `<loanId>` / `<borrowerId>` below. Step 1's response gives you the
activity `id` to substitute for `<id>` in every step after — run them in
order against the same activity to exercise the full lifecycle.

### 1. Create activity — `POST http://localhost:4000/collections`

| Field | Required | Meaning |
|---|---|---|
| `loanId` | yes | The loan this activity is against. Must be a real, non-deleted loan. |
| `activityType` | yes | One of `CALL`, `REMINDER_SENT`, `BRANCH_VISIT`, `PROMISE_TO_PAY_CREATED`, `PROMISE_FULFILLED`, `PROMISE_BROKEN`, `RECOVERY_VISIT`, `LEGAL_NOTICE`, `SETTLEMENT_DISCUSSION`, `OTHER` (see `constants/collections.constants.ts`). |
| `followUpDate` | no | `YYYY-MM-DD`. Defaults to today if omitted. Also becomes the case's `nextFollowUpDate`. |
| `contactPerson` | no | Free text — who was spoken to. |
| `remarks` / `notes` | no | Free text note for this activity. Either key works; `remarks` wins if both are sent. |
| `assignedTo` | no | UUID of the collections officer/user handling this loan's case. |
| `followUpBy` | no | UUID of the user who logged this specific activity. |
| `status` | no | Sets the loan's case status at creation time. One of `OPEN`, `PROMISE_TO_PAY`, `FOLLOW_UP`, `CLOSED`. |
| `promiseDate` / `promiseAmount` | no | Only set these if you want to record a promise inline instead of using the dedicated Promise to Pay endpoint (step 8). |

Request body:

```json
{
    "loanId": "<loanId>",
    "activityType": "CALL",
    "followUpDate": "2026-07-15",
    "contactPerson": "Rahul Sharma",
    "remarks": "Customer called; promised to pay by month end."
}
```

Expected response — `201 Created`:

```json
{
    "id": "b3d2e1f0-4a5b-4c6d-8e9f-0a1b2c3d4e5f",
    "loanId": "<loanId>",
    "borrowerId": "<borrowerId>",
    "status": "OPEN",
    "assignedTo": null,
    "activityType": "CALL",
    "followUpDate": "2026-07-15",
    "contactPerson": "Rahul Sharma",
    "remarks": "Customer called; promised to pay by month end.",
    "followUpBy": null,
    "promiseDate": null,
    "promiseAmount": null,
    "promiseKept": null,
    "createdAt": "2026-07-08T10:15:00.000Z",
    "updatedAt": "2026-07-08T10:15:00.000Z"
}
```

`status` is `null` only if a case couldn't be found or created for some
reason; in normal operation it's always `OPEN` (or whatever `status` you
passed) on the very first activity for a loan.

### 2. Get activity by id — `GET http://localhost:4000/collections/<id>`

No body. `<id>` is the activity id returned by step 1.

Expected response — `200 OK`: same shape as step 1's response.

### 3. List activities for a loan — `GET http://localhost:4000/collections/loan/<loanId>`

No body. Returns every activity ever logged against that loan (across its
one case), newest `followUpDate` first.

Expected response — `200 OK`:

```json
[
    {
        "id": "b3d2e1f0-4a5b-4c6d-8e9f-0a1b2c3d4e5f",
        "loanId": "<loanId>",
        "borrowerId": "<borrowerId>",
        "status": "OPEN",
        "activityType": "CALL",
        "followUpDate": "2026-07-15",
        "...": "..."
    }
]
```

Returns `[]` (not a 404) if the loan exists but has no activities yet.

### 4. List activities for a customer — `GET http://localhost:4000/collections/customer/<borrowerId>`

No body. `<borrowerId>` is the customer's id — returns every activity
across *all* of that customer's loans, newest first. Same response shape
as step 3.

### 5. Update an activity — `PUT http://localhost:4000/collections/<id>`

All fields optional — only what you send gets changed; everything else on
the activity is left as-is (`assignedTo`, if sent, updates the case, not
the activity itself).

```json
{
    "remarks": "Follow-up call: customer confirmed payment plan.",
    "contactPerson": "Rahul Sharma",
    "activityType": "BRANCH_VISIT"
}
```

Expected response — `200 OK`: the updated activity, same shape as step 1.

### 6. Update status — `PATCH http://localhost:4000/collections/<id>/status`

| Field | Required | Meaning |
|---|---|---|
| `status` | yes | One of `OPEN`, `PROMISE_TO_PAY`, `FOLLOW_UP`, `CLOSED`. Applied to the activity's parent loan case. |

```json
{ "status": "FOLLOW_UP" }
```

Expected response — `200 OK`: the activity with `status` updated.

### 7. Update next follow-up date — `PATCH http://localhost:4000/collections/<id>/follow-up`

| Field | Required | Meaning |
|---|---|---|
| `followUpDate` | yes | `YYYY-MM-DD`. Updates both this activity's date and the case's `nextFollowUpDate`. |

```json
{ "followUpDate": "2026-07-22" }
```

Expected response — `200 OK`: the activity with `followUpDate` updated.

### 8. Create a Promise to Pay — `POST http://localhost:4000/collections/<id>/promise-to-pay`

| Field | Required | Meaning |
|---|---|---|
| `promiseDate` | yes | `YYYY-MM-DD` — the date the customer promised to pay by. |
| `promiseAmount` | yes | Non-negative number — the amount promised. |

```json
{ "promiseDate": "2026-07-20", "promiseAmount": 25000 }
```

Expected response — `201 Created`: the activity with `promiseDate` /
`promiseAmount` set, `promiseKept: null`, and `status: "PROMISE_TO_PAY"`.

### 9. Close a Promise to Pay — `PATCH http://localhost:4000/collections/<id>/promise-to-pay/close`

| Field | Required | Meaning |
|---|---|---|
| `kept` | yes | `true` if the customer paid as promised, `false` if they didn't. Drives whether the case moves to `CLOSED` or `FOLLOW_UP`. |
| `remarks` | no | Free text note on how it was resolved. |

Promise kept:

```json
{ "kept": true, "remarks": "Paid in full via UPI on 2026-07-20." }
```

Promise broken:

```json
{ "kept": false, "remarks": "Customer did not pay as promised; escalate." }
```

Expected response — `200 OK`: the activity with `promiseKept` set and
`status` moved to `CLOSED` (kept) or `FOLLOW_UP` (broken). Calling this a
second time on the same activity returns `409 InvalidPromiseToPayStateError`.

### 10. Delete an activity — `DELETE http://localhost:4000/collections/<id>`

No body. Soft-deletes the activity (`deletedAt` set — it stops showing up
in any GET). Expected response — `204 No Content`.

### Error cases worth trying

| Request | Result |
|---|---|
| Step 6 with `{ "status": "PAID" }` | `400 InvalidStatusError` — not a real value in this schema (see the enum note above). |
| Step 1 with only `{ "activityType": "CALL" }` (no `loanId`) | `400 ValidationError` |
| `GET /collections/not-a-uuid` | `400 ValidationError` |
| Step 1 with a random UUID for `loanId` | `404 LoanNotFoundError` |
| Step 9 run twice on the same `<id>` | `409 InvalidPromiseToPayStateError` on the second call |

## How another module consumes this

```ts
import { CollectionsService } from "../collections";

// Logging a recovery call against a loan
const activity = await CollectionsService.createActivity({
    loanId: loan.id,
    activityType: "CALL",
    contactPerson: "Rahul Sharma",
    remarks: "Customer called; promised to pay by month end.",
});

// Checking a loan's recovery history before taking further action
const history = await CollectionsService.getLoanActivities(loan.id);
const isInLegal = history.some((a) => a.status === "CLOSED" || a.status === "PROMISE_TO_PAY");
```

Mounting the routes in the app entry point:

```ts
import { collectionsRouter } from "./modules/collections";

app.use("/collections", collectionsRouter);
```

## Error handling

All failures are instances of `CollectionsError` subclasses
(`CollectionActivityNotFoundError`, `LoanNotFoundError`,
`CustomerNotFoundError`, `ValidationError`, `InvalidActivityTypeError`,
`InvalidStatusError`, `InvalidPromiseToPayStateError`,
`CollectionsPersistenceError`), mapped to HTTP status codes by
`utils/http-error-mapper.ts`. Consumers calling `CollectionsService`
directly (not through HTTP) can catch `CollectionsError` generically or a
specific subclass.

## Logging

`utils/logger.ts` logs the action (`CREATE`, `UPDATE`, `DELETE`, `GET`,
`LIST_LOAN`, `LIST_CUSTOMER`, `STATUS_UPDATE`, `FOLLOW_UP_UPDATE`,
`PROMISE_CREATED`, `PROMISE_CLOSED`), the relevant id, and outcome — never
raw request bodies, row contents, or secrets.

## What this module intentionally does not do

- No schedulers, cron jobs, queues, or automatic reminders — this module
  only records activity; triggering it is another module's job.
- No repositories/DAOs — Drizzle is used directly inside `CollectionsService`.
- No authentication/authorization — that's the consuming app's job. Route
  handlers accept whatever identity fields (e.g. `assignedTo`,
  `followUpBy`) the caller supplies; wire them to `req.user` once auth
  middleware exists upstream.

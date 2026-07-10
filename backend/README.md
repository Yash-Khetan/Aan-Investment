# Backend — `dev-c-integration`

This document describes the **current, actual** structure of the backend as merged on
`dev-c-integration` — not the aspirational plan in the repo root `README.md`. If something
here disagrees with that file, trust this one; it's written directly against the code.

`dev-c-integration` is the integration branch where the independently-built feature
modules (collateral, collections, document-vault, notifications, reports,
accounting-export, dashboard) are merged, wired into a single Express app, and made to
run together. Each module was originally built and tested in isolation on its own
`feat/*` branch; this branch is where they become one running server.

## Tech Stack

- Node.js (ESM — `"type": "module"`)
- TypeScript, run via `tsx` (no compiled `dist/` in the normal dev loop)
- Express 5
- Drizzle ORM + PostgreSQL (via `postgres` / Supabase)
- ExcelJS + json2csv (reports, accounting-export)
- Nodemailer + Twilio (notifications)
- Multer (document-vault)
- Zod (reports validation)

## Getting Started

```bash
cd backend
npm install
```

Create a `.env` file in `backend/` (see [Environment Variables](#environment-variables)
below). At minimum `DATABASE_URL` is required — nothing starts without it.

```bash
npm run dev         # tsx watch src/index.ts — hot-reloading dev server
npm run typecheck    # tsc --noEmit -p tsconfig.json
npm run build        # tsc -p tsconfig.json -> dist/
npm start            # tsx src/index.ts
npm run seed          # tsx src/db/seed/fullSeed.ts — comprehensive demo data, safe to re-run
```

The server listens on `http://localhost:3000` (override with `PORT`). `GET /health`
returns `{ "status": "ok" }` once it's up.

### Docker

```bash
cd backend
docker build -t aan-backend .
docker run -p 3000:3000 --env-file .env aan-backend
```

## Project Structure

```text
backend/
├── config/
│   └── db.js                  unused legacy db client — see "Known quirks"
├── drizzle.config.ts
├── tsconfig.json
├── package.json
└── src/
    ├── index.ts                ← THE entry point. Boots Express, mounts every module.
    ├── db/
    │   ├── index.ts            the real db client (`db`), used by every module
    │   ├── relations.ts
    │   ├── schema/              one file per domain area, all re-exported via schema/index.ts
    │   ├── migrations/          drizzle-kit output
    │   └── seed/
    │       ├── fullSeed.ts      npm run seed — comprehensive demo data across every module
    │       └── dashboardSeed.ts  older, narrower seed kept for reference; superseded by fullSeed.ts
    ├── routes/
    │   └── lookup.routes.ts    small read-only loan/borrower id lookup — see below
    └── modules/
        ├── accounting-export/
        ├── collateral/
        ├── collections/
        ├── dashboard/
        ├── document-vault/
        ├── notifications/       service-only, no HTTP routes — see dedicated section below
        └── reports/
```

> There is no top-level `index.ts`/`index.js` at `backend/` — `src/index.ts` is the only
> entry point (see "Known Quirks" for why this is worth watching).

Every module (except `notifications`, and `dashboard` partially) follows the same
internal shape: `controllers/`, `routes/`, `services/`, `types/`, `utils/`, `validators/`,
an `index.ts` public API, and its own `README.md` with full endpoint documentation. Read
a module's own README for its actual request/response contracts — this file only covers
how the modules fit together.

## Entry Point

`backend/src/index.ts` is the **only** app entry point. It does three things: applies
global middleware (`cors`, `express.json`), mounts every module's router at a fixed base
path, and installs a catch-all JSON 404 handler.

```ts
app.use("/documents", documentRouter);
app.use("/collateral", collateralRouter);
app.use("/collections", collectionsRouter);
app.use("/reports", reportsRouter);
app.use("/accounting", accountingExportRouter);
app.use("/dashboard", dashboardRouter);
app.use("/lookup", lookupRouter);
```

| Base path | Module | Router import |
|---|---|---|
| `/documents` | document-vault | `import { documentRouter } from "./modules/document-vault"` |
| `/collateral` | collateral | `import { collateralRouter } from "./modules/collateral"` |
| `/collections` | collections | `import { collectionsRouter } from "./modules/collections"` |
| `/reports` | reports | `import { reportsRouter } from "./modules/reports"` |
| `/accounting` | accounting-export | `import { accountingExportRouter } from "./modules/accounting-export"` |
| `/dashboard` | dashboard | `import dashboardRouter from "./modules/dashboard/routes/dashboard.routes.js"` (default export, no module-level `index.ts` yet) |
| `/lookup` | — (`src/routes/lookup.routes.ts`) | `import { lookupRouter } from "./routes/lookup.routes.js"` — see below |
| — | notifications | not mounted — internal service only, see below |

### The `/lookup` routes

Two trivial, read-only endpoints — not a full module (no controllers/services/etc.,
just two `SELECT` queries in one file) — added because **no other endpoint in this
backend returns a loan or borrower id next to a human-readable label**. `reports`'
loan-register returns `loanAccountNumber` but never the row's actual `id`; `collateral`,
`collections`, and `document-vault` all require a real loan/borrower UUID as input.
Without this, a frontend has no way to look up which UUID a given loan/borrower
actually is.

- `GET /lookup/loans` → `[{ id, loanAccountNumber, customerName, status, outstandingPrincipal }]`
- `GET /lookup/borrowers` → `[{ id, borrowerCode, name }]`

**To add a new module's routes to the running app**: export a `Router` from the module's
`index.ts` (or its own `routes/` file, matching the existing pattern), import it into
`src/index.ts`, and add one `app.use("/your-path", yourRouter)` line. That's the entire
integration step — nothing else in the app needs to change.

Several modules (`collateral`, `collections`, `reports`) also have a standalone dev
server built into their own `index.ts`, useful for testing a module in total isolation
against the real database without booting the full app:

```bash
npx tsx src/modules/collateral/index.ts   # listens on :4000, seeds+cleans up a test loan
npx tsx src/modules/reports/index.ts      # listens on :4001
```

This only runs when that file is executed directly — importing from it (as `src/index.ts`
does) never triggers it.

## The Notifications Module (no HTTP routes)

`notifications` is **not mounted in `src/index.ts` and has no routes/controllers of its
own** — it is a plain internal service that other modules call directly, the same way
they call the database. There is nothing to reach over HTTP here; you consume it by
importing from `./modules/notifications`.

Full public surface (`src/modules/notifications/index.ts`):

```ts
export { notificationService } from "./services/notification.service";
export type { NotificationRecordMeta } from "./services/notification.service";

export type { EmailOptions, EmailAttachment, EmailResult } from "./types/email.types";
export type { SMSResult } from "./types/sms.types";
export type { WhatsappResult } from "./types/whatsapp.types";

export {
    NotificationError,
    InvalidRecipientError,
    InvalidNotificationContentError,
    ProviderConfigError,
    EmailDeliveryError,
    SMSDeliveryError,
    WhatsappDeliveryError,
} from "./utils/errors";
```

`notificationService` is a singleton (`NotificationService` instance) with three methods:

| Method | Signature | Channel |
|---|---|---|
| `sendEmail` | `(options: EmailOptions, meta: NotificationRecordMeta) => Promise<EmailResult>` | Nodemailer / SMTP |
| `sendSMS` | `(phoneNumber: string, message: string, meta: NotificationRecordMeta) => Promise<SMSResult>` | Twilio |
| `sendWhatsapp` | `(phoneNumber: string, message: string, meta: NotificationRecordMeta) => Promise<WhatsappResult>` | Twilio |

`meta: NotificationRecordMeta` (`{ userId, title, link? }`) identifies who the
notification is for. Every dispatch — success or failure — is recorded in the
`notifications` table via `saveNotification`, so delivery history is always queryable
regardless of whether the send itself succeeded.

Example usage from another module's service layer:

```ts
import { notificationService } from "../../notifications";

await notificationService.sendEmail(
    { to: borrower.email, subject: "Payment received", text: "..." },
    { userId: borrower.id, title: "Payment confirmation" },
);
```

> SMS sending exists (`services/sms.service.ts`) but isn't wired into
> `notificationService.sendSMS`'s config yet — see the module's own README for current
> status before relying on it.

Do not import `email.service.ts` / `sms.service.ts` / `whatsapp.service.ts` directly from
outside the module — always go through `notificationService`, so the underlying provider
can change without touching call sites.

## Database Layer

- **Schema**: `src/db/schema/*.ts`, one file per domain (`loan.ts`, `borrower.ts`,
  `payment.ts`, `accounting.ts`, `collateral.ts`, `collection.ts`, `document.ts`,
  `notification.ts`, `interest.ts`, `repayment.ts`, `report.ts`, `audit.ts`, `system.ts`,
  `auth.ts`, `shared.ts` for common enums/columns), all re-exported through
  `src/db/schema/index.ts`.
- **Client**: `src/db/index.ts` exports `db` (Drizzle + `postgres-js`). Every module
  imports this one client — it's the actual source of truth for DB access.
- **Migrations**: `src/db/migrations/`, generated by `drizzle-kit` per `drizzle.config.ts`.
- **Seed**: `npm run seed` runs `src/db/seed/fullSeed.ts` — comprehensive, idempotent
  demo data covering every module: 5 borrowers, 8 loans (one per status), interest
  configs, disbursement tranches, repayment schedules + installments, payments +
  allocations, collateral + insurance, collection activities (incl. a kept and a
  broken Promise to Pay), and 18 real documents uploaded to Supabase Storage. Safe to
  re-run — it clears anything tagged `SEED-`/`__TEST_` before inserting. The older
  `dashboardSeed.ts` (2 borrowers, 5 loans) still exists but is superseded; nothing
  runs it automatically.
- Read-only modules (`accounting-export`, `reports`) never write; every query is
  `SELECT`-only by design, documented in their own READMEs.

## Known Quirks / Tech Debt

- **`backend/config/db.js`** is a second, unused Drizzle client left over from an earlier
  iteration. Nothing currently imports it (`grep` confirms zero references) — the real
  client is `src/db/index.ts`. Safe to delete once someone confirms nothing depends on it.
- **`backend/index.ts` / `backend/index.js`** at the repo root should not exist — if you
  see either reappear (e.g. from a stale branch merge), delete it. `src/index.ts` is the
  only entry point; a duplicate at the root will not be wired to anything and will just
  confuse the next person.
- The `dashboard` module's own README documents its base path as `/api/dashboard`; the
  actual mount in `src/index.ts` is `/dashboard` (no `/api` prefix, matching every other
  module). The README is stale — trust the routing table above.
- `dashboard` doesn't yet have a module-level `index.ts` public API like the other six
  modules — its router is imported directly from `modules/dashboard/routes/dashboard.routes.ts`.
  Worth adding one for consistency when someone next touches that module.

## Environment Variables

| Variable | Used by |
|---|---|
| `DATABASE_URL` | everything (db client) |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | document-vault (storage) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_TO` | notifications (email) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `TWILIO_WHATSAPP_NUMBER` | notifications (SMS/WhatsApp) |
| `PORT` | server (optional, defaults to `3000`) |

## Module Reference

| Module | Mount path | One-line purpose | Docs |
|---|---|---|---|
| document-vault | `/documents` | Generic file storage — upload/list/download/delete documents for any entity type, backed by Supabase Storage. | `src/modules/document-vault/README.md` |
| collateral | `/collateral` | Tracks security pledged against a loan (property, valuations, LTV, insurance). | `src/modules/collateral/README.md` |
| collections | `/collections` | Loan recovery activity — calls, follow-ups, Promises to Pay, activity history. | `src/modules/collections/README.md` |
| reports | `/reports` | Read-only MIS/reporting layer (loan register, customer/collateral/collections/document reports, portfolio summary), JSON/CSV/XLSX. | `src/modules/reports/README.md` |
| accounting-export | `/accounting` | Read-only standardized accounting entry exports (principal, interest, penalties, disbursements, closures, write-offs, refunds) for import into any ERP. | `src/modules/accounting-export/README.md` |
| dashboard | `/dashboard` | Read-only aggregate portfolio/collections summary endpoints. | `src/modules/dashboard/README.md` (base path in that doc is stale — see Known Quirks) |
| notifications | *(not mounted — internal service)* | Single entry point (`notificationService`) for email/SMS/WhatsApp dispatch, with delivery history recorded in `notifications` table. | `src/modules/notifications/README.md` |
| lookup | `/lookup` | Two read-only loan/borrower id lookup endpoints (not a full module) — see "The `/lookup` routes" above. | — |

## Frontend

`../frontend/` is a React + TypeScript app that consumes this backend directly (no
mock data) — see `../frontend/README.md`. Run both at once: this server on `:3000`,
`cd frontend && npm run dev` on `:5173`.

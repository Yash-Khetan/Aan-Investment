# Aan Investment LMS — System Architecture & Working Structure

> Complete technical reference for the Loan Management System built for
> **Aan Finance & Investment Private Limited** (NBFC, secured & structured lending).
> Accurate as of the `integrations` branch, July 2026.

---

## 1. What the System Is

An **internal enterprise Loan Management System** covering the full loan lifecycle:

- Borrower management (companies, individuals, promoters, guarantors)
- Loan management with tranches and status history
- A configurable **Interest Calculation Engine** (7 day-count bases, step-up/step-down slabs, event-triggered rates, penal interest)
- A **Repayment Schedule Engine** (EMI / Bullet / Interest-Only / Structured, versioned schedules)
- A **Payment Waterfall Engine** (configurable Penalty → Interest → Principal ordering, overflow cascading)
- Double-entry accounting journal + accounting exports (CSV/Excel)
- Collateral & insurance & charge (CERSAI/ROC) tracking
- Document vault (Supabase Storage)
- Collections & follow-ups (promise-to-pay tracking)
- Reports & MIS with export
- Audit trail, notifications (Email/SMS/WhatsApp), RBAC

There is **no customer-facing portal** — all users are staff.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Backend runtime | Node.js 20+, TypeScript (strict, ESM), run via `tsx` |
| Web framework | Express 5 |
| ORM / DB | Drizzle ORM → PostgreSQL (Supabase, transaction pooler on :6543 via `postgres-js`) |
| Validation | Zod v4 |
| Auth | Opaque session tokens (server-side sessions, **no JWT**), Argon2id password hashing |
| Security | Helmet, CORS allow-listing, `express-rate-limit` (100 req / 15 min / IP) |
| Logging | Pino + pino-http |
| Files | Multer upload → Supabase Storage |
| Notifications | Nodemailer (SMTP), Twilio (SMS + WhatsApp) |
| Exports | exceljs, json2csv |
| Math | mathjs (safe evaluation of custom interest formulas) |
| Frontend | React 19 + Vite 8 + TypeScript, React Router 7, TanStack Query 5, Tailwind CSS 4, oxlint |

---

## 3. Repository Layout

```
Aan-Investment/
├── README.md
├── punchlist/                  # static HTML punchlist page (index.html/script.js/style.css)
├── backend/
│   ├── drizzle.config.ts
│   └── src/
│       ├── index.ts            # SINGLE composition root + process entry point
│       ├── config/             # env validation → typed `config` object
│       ├── db/
│       │   ├── index.ts        # THE single db/pool entry point (drizzle + postgres-js)
│       │   ├── schema/         # one file per domain (17 files, see §6)
│       │   ├── relations.ts
│       │   ├── migrations/     # drizzle-kit output
│       │   └── seed/           # roles/permissions/admin bootstrap + full demo seed
│       ├── common/             # AppError hierarchy, apiResponse, asyncHandler, pagination, crypto, date-utils
│       ├── middleware/         # cors, errorHandler, notFound, rateLimit, requestLogger, validate
│       ├── routes/
│       │   ├── index.ts        # /api/v1 router (borrowers, loans)
│       │   └── lookup.routes.ts# read-only id+label lookups for the UI
│       ├── dev/resetPasswordPage.ts  # dev-only reset page (never mounted in prod)
│       └── modules/            # feature modules (see §4.2)
└── frontend/
    └── src/
        ├── main.tsx / App.tsx  # router + provider setup
        ├── lib/                # api.ts (fetch wrapper), format.ts
        ├── components/         # Layout, ProtectedRoute, AdminRoute, ui/*, charts/*
        └── features/           # one folder per screen/domain (see §8)
```

---

## 4. Backend Architecture

### 4.1 Composition root & request pipeline

`backend/src/index.ts` is the **only** entry point. It validates env config at
import time (fail-fast), verifies DB connectivity **before** listening, then
builds the Express app with this deliberate middleware order:

1. `helmet()` — security headers
2. CORS (allow-listed origins; explicit list required in production)
3. `requestLogger` (pino-http, assigns `req.id`)
4. Rate limiter (100 req / 15 min / IP)
5. Body parsers (`express.json`, urlencoded), `cookie-parser`
6. `GET /health` liveness probe
7. **Feature routers** (see §7)
8. `notFound` → `errorHandler` (funnel; must be last)

Graceful shutdown on SIGTERM/SIGINT/unhandled errors: stop HTTP → drain
in-flight requests → close DB pool, with a 10 s force-exit failsafe.

### 4.2 Module pattern

Every business domain lives in `backend/src/modules/<name>`. Two generations of
layout coexist:

- **Flat style** (auth, borrower, loan, interest, repayment, payment, accounting):
  `*.routes.ts` → `*.controller.ts` → `*.service.ts` → `*.repository.ts`,
  plus `*.validators.ts` (Zod), `*.types.ts`, `*.constants.ts`.
- **Foldered style** (collateral, collections, document-vault, reports,
  accounting-export, notifications, dashboard): same layers split into
  `routes/`, `controllers/`, `services/`, `validators/`, `types/`, `utils/`
  subfolders, with module-local error mappers and loggers.

Shared rules:
- Only repositories touch `db` (imported from `src/db/index.ts` — the sole pool).
- Controllers never contain business logic; services never touch Express types.
- All input validated with Zod via the `validate({ body, params, query })` middleware (422 on failure).
- Errors are typed `AppError` subclasses (`UnauthorizedError`, `ForbiddenError`, …) mapped centrally to HTTP codes.

### 4.3 Response-shape caveat (known inconsistency)

Modules are **not uniform** in response envelope:
- accounting-export, reports, dashboard wrap responses in `{ success, data }`.
- collateral, collections, document-vault, lookup return the resource directly.

The frontend's `apiRequest` handles transport only; each feature's `api.ts`
unwraps the shape its module actually returns.

---

## 5. Authentication & Authorization

### 5.1 Session-token auth (no JWT)

- `POST /auth/login` verifies the Argon2 hash and issues an **opaque random
  session token** (not a JWT — nothing is signed). It is stored server-side in
  `user_sessions` (with IP, user-agent, `expiresAt` = now + `REFRESH_TOKEN_TTL_DAYS`, default 7 days).
- The client sends it as `Authorization: Bearer <token>` on **every** request.
- `authenticate` middleware validates the token **against the database on each
  request** — unknown/expired/revoked sessions and deactivated/deleted users are
  rejected with 401. It attaches `req.user = { id, roles }` (roles read fresh).
- There is **no refresh endpoint** and no short-lived access token. The frontend
  persists the token in `localStorage` (`sessionToken`) and mirrors it in memory.
- `POST /auth/logout` revokes the session row; idempotent.
- Password reset: `forgot-password` emails a link (`APP_PASSWORD_RESET_URL?token=…`),
  single-use tokens in `password_reset_tokens`.
- `POST /auth/register` creates an account only — it issues no tokens.

### 5.2 RBAC

- Tables: `users` ⇄ `user_roles` ⇄ `roles` ⇄ `role_permissions` ⇄ `permissions`.
- Permissions are machine keys like `user:read`, `loan:create`.
- `authorize(...perms)` middleware = logical AND; `authorizeAny(...)` = OR.
  Effective permissions are resolved from the DB **per request**, so revocation
  is immediate.
- Routes never name roles — only permissions. The **seed** is the single source
  of truth for role→permission grants:
  - `EMPLOYEE` (default for every account): `loan:read`, `loan:create`.
  - `ADMIN` (exactly one bootstrap account, `SEED_ADMIN_EMAIL`): EMPLOYEE perms
    plus user management (`user:read`, `user:create`, `user:activate`, `user:deactivate`, …).
- Accounts are deactivated, never deleted (no `DELETE /users`).
- The seed also retires legacy roles/admin emails idempotently.

---

## 6. Database Schema (PostgreSQL via Drizzle)

Conventions used everywhere:
- PK: `id uuid defaultRandom()`.
- `money(name)` = `numeric(18,2)`; rates = `numeric(8,4)`.
- `timestamps` = `createdAt` / `updatedAt` (tz) + nullable `deletedAt` (soft delete).
- "Current row" pattern: config-like tables carry `isCurrent boolean` with an
  index on `(loanId, isCurrent)`; a new revision supersedes the old.

### 6.1 Enums (`schema/shared.ts`)

| Enum | Values |
|---|---|
| `loan_status` | PENDING, OVERDUE, CLOSED, WRITTEN_OFF |
| `loan_type` | SECURED, UNSECURED |
| `security_type` | PROPERTY, MORTGAGE, STRUCTURED_CREDIT, PERSONAL_GUARANTEE, CORPORATE_GUARANTEE, NONE |
| `constitution` | INDIVIDUAL, PROPRIETORSHIP, PARTNERSHIP, LLP, PRIVATE_LIMITED, PUBLIC_LIMITED, TRUST, HUF, OTHER |
| `interest_basis` | ACTUAL_365, ACTUAL_360, THIRTY_360, MONTHLY, FIXED_MONTHLY, FULL_MONTH, CUSTOM |
| `interest_rule_type` | NORMAL, STEP_UP, STEP_DOWN, EVENT_BASED, CUSTOM |
| `penal_interest_type` | PERCENTAGE, FIXED_AMOUNT |
| `penal_interest_base` | ENTIRE_OUTSTANDING, OVERDUE_INSTALLMENT_ONLY |
| `payment_status` | PENDING, PARTIAL, SUCCESS, FAILED, CANCELLED (used by payments AND installments) |
| `payment_mode` | NEFT, RTGS, IMPS, UPI, CHEQUE, CASH, BANK_TRANSFER, OTHER |
| `repayment_type` | EMI, BULLET, INTEREST_ONLY, STRUCTURED, CUSTOM |
| `waterfall_bucket_type` | PENALTY, INTEREST, PRINCIPAL, SPECIFIC_TRANCHE |
| `document_type` | SANCTION_LETTER, LOAN_AGREEMENT, MORTGAGE_DEED, DPN, BOARD_RESOLUTION, PERSONAL_GUARANTEE, CORPORATE_GUARANTEE, LEGAL_OPINION, VALUATION_REPORT, INSURANCE, KYC, FINANCIAL_STATEMENT, OTHER |
| `document_owner` | BORROWER, LOAN, PROPERTY, PROMOTER, GUARANTOR |
| `reminder_status` / `reminder_channel` | PENDING, SENT, FAILED / EMAIL, WHATSAPP, SMS |
| `notification_status` | SUCCESS, FAILED |
| `collection_status` | OPEN, PROMISE_TO_PAY, FOLLOW_UP, CLOSED |
| `accounting_entry_type` | DISBURSEMENT, INTEREST_ACCRUAL, INTEREST_RECEIPT, PRINCIPAL_RECEIPT, PENAL_INTEREST, WRITE_OFF |
| `audit_action` | CREATE, UPDATE, DELETE, LOGIN, LOGOUT |
| `entity_status` | ACTIVE, INACTIVE |

### 6.2 Auth domain (`auth.ts`)

| Table | Purpose / key columns |
|---|---|
| `users` | firstName, lastName, **email (unique)**, phone, passwordHash (Argon2), isEmailVerified, isActive, lastLoginAt, soft delete |
| `roles` | name (unique), isSystemRole, isActive |
| `permissions` | name (unique machine key, e.g. `loan:create`) |
| `role_permissions` | roleId ⇄ permissionId (unique pair, cascade) |
| `user_roles` | userId ⇄ roleId (unique pair, cascade on user) |
| `user_sessions` | userId, **refreshToken** (the opaque session token itself), ipAddress, userAgent, expiresAt |
| `password_reset_tokens` | userId, token (unique), expiresAt, used |

### 6.3 Borrower domain (`borrower.ts`)

| Table | Purpose / key columns |
|---|---|
| `borrowers` | **borrowerCode (unique)**, name, groupName, constitution, contact (email/phone/altPhone), address (line1/2, city, state, pincode), identity (PAN/GST/CIN), dateOfIncorporation, natureOfBusiness, internalRating + ratingRemarks, relationshipManagerId → users, status (ACTIVE/INACTIVE), notes |
| `promoters` | borrowerId (cascade), name, designation, PAN, Aadhar, DIN, contact, address, shareholdingPercent numeric(5,2) |
| `guarantors` | borrowerId (cascade), name, guaranteeType, PAN, contact, address, netWorth (money) |

### 6.4 Loan domain (`loan.ts`)

| Table | Purpose / key columns |
|---|---|
| `loans` | **loanAccountNumber (unique)**, borrowerId, loanType, securityType (default NONE), repaymentType, sanctionedAmount, disbursedAmount, outstandingPrincipal, interestRate numeric(8,4), tenureMonths, moratoriumMonths, sanctionDate, firstDisbursementDate, maturityDate, purpose/approvalNotes/remarks, status (default PENDING), createdBy → users, relationshipManagerId → users |
| `loan_tranches` | loanId (cascade), trancheNumber, amount, disbursementDate — multi-tranche disbursement |
| `loan_status_history` | loanId, fromStatus → toStatus, changedBy, reason, changedAt |

### 6.5 Interest domain (`interest.ts`)

| Table | Purpose / key columns |
|---|---|
| `interest_configs` | loanId (cascade), annualRate numeric(8,4), interestBasis, ruleType (default NORMAL), effectiveFrom/effectiveTo, **isCurrent**, `customFormula` text (only when basis = CUSTOM; evaluated via mathjs, never `eval`) |
| `interest_rules` | interestConfigId (cascade), fromMonth/toMonth (time slabs for step-up/down), rate, triggerEvent (event-based rules) |
| `penal_interest_rules` | loanId (cascade), penalType (PERCENTAGE/FIXED_AMOUNT), penalRate, penalAmount, penalBase (default OVERDUE_INSTALLMENT_ONLY), gracePeriodDays (default 0), **isCurrent** |

### 6.6 Repayment domain (`repayment.ts`)

| Table | Purpose / key columns |
|---|---|
| `repayment_schedules` | loanId (cascade), **version** (int, default 1), **isCurrent** — schedules are versioned, never mutated in place |
| `installments` | scheduleId (cascade), installmentNumber, dueDate, expected principal/interest/total, **paid** principal/interest/total, status (payment_status enum: PENDING → PARTIAL → SUCCESS), paidDate |

### 6.7 Payment domain (`payment.ts`, `paymentWaterfall.ts`)

| Table | Purpose / key columns |
|---|---|
| `payments` | **paymentRefNumber (unique)**, loanId, amount, paymentDate, valueDate, paymentMode, status (default PENDING), transactionRef, receivedBy → users |
| `payment_allocations` | paymentId (cascade), installmentId, principalApplied, interestApplied, penalInterestApplied, otherCharges — one payment can allocate across many installments |
| `payment_waterfall_configs` | loanId (cascade), name, **isCurrent** |
| `payment_waterfall_steps` | waterfallConfigId (cascade), **stepOrder** (unique per config), bucketType, trancheId (only when SPECIFIC_TRANCHE) |

### 6.8 Collateral domain (`collateral.ts`)

| Table | Purpose / key columns |
|---|---|
| `collaterals` | loanId (cascade), ownerId → borrowers, securityType, property details (type, address, surveyNumber, areaInSqFt), valuation (estimatedValue, valuationDate, valuationBy), mortgage (type, date, deedNumber), **ltvRatio numeric(5,2)**, status |
| `collateral_insurance` | collateralId (cascade), policyNumber, insurer, insuredAmount, premiumAmount, startDate/expiryDate (expiry indexed), status |
| `charge_records` | collateralId (cascade), chargeType (CERSAI/ROC), registrationNumber/Date, satisfactionDate, status |

### 6.9 Other domains

| Table | Purpose |
|---|---|
| `documents` (`document.ts`) | Polymorphic vault: (ownerType, ownerId) + documentType, fileName, fileUrl, storagePath (Supabase Storage), mimeType, fileSizeBytes, version, isVerified/verifiedBy, uploadedBy |
| `collection_cases` (`collection.ts`) | loanId, borrowerId, status, assignedTo → users, priority, overdueAmount, nextFollowUpDate, resolutionDate |
| `follow_ups` | collectionCaseId (cascade), followUpDate/type, contactPerson, followUpBy, **promise-to-pay**: promiseDate, promiseAmount, promiseKept |
| `journal_entries` (`accounting.ts`) | **entryNumber (unique)**, loanId, paymentId, entryType (accounting_entry_type), entryDate, narration, isPosted, isExported |
| `journal_entry_lines` | journalEntryId (cascade), accountCode, accountName, debitAmount, creditAmount — double-entry legs |
| `reminders` (`reminder.ts`) | loanId, borrowerId, channel, scheduledDate, sentAt, status, subject/message, recipientContact |
| `notifications` (`notification.ts`) | userId (cascade), title, message, type, channel, status, isRead/readAt, link |
| `report_definitions` / `report_runs` (`report.ts`) | Report catalog (slug unique) + run history (parameters jsonb, generatedBy, fileUrl, format, status, timings) |
| `audit_logs` (`audit.ts`) | userId, action, entityType + entityId, oldValues/newValues (jsonb), ipAddress, userAgent |
| `system_settings` (`system.ts`) | key (unique) / value / category / isEditable |

---

## 7. Core Engines (business logic)

### 7.1 Interest Calculation Engine (`modules/interest/`)

`calculateInterestForLoan(input)` orchestrates:

1. **Load config** — the loan's current `interest_configs` row (+ its `interest_rules`).
2. **Detect events** — `eventDetector.ts` inspects installment snapshots /
   extension flag as of the date and returns active event names.
3. **Resolve effective rate** — `rateResolver.ts` layers time slabs
   (`fromMonth`–`toMonth` vs loan age) and triggered events over the base rate.
   **Conflict rule: the HIGHEST rate wins**, so a triggered event can never
   silently undercut a scheduled step-up. Result carries a `rateSource`
   (`BASE_RATE` | `TIME_SLAB` | `EVENT_TRIGGERED`).
4. **Run the day-count strategy** — a registry (`strategies/index.ts`) maps each
   `interest_basis` to a pure `calculate({principal, annualRate, periodStart, periodEnd})`
   strategy: `ACTUAL_365`, `ACTUAL_360`, `THIRTY_360`, `MONTHLY`, `FIXED_MONTHLY`,
   `FULL_MONTH`. The `CUSTOM` basis instead evaluates `interest_configs.customFormula`
   through **mathjs** (sandboxed, never raw `eval`).
5. **Layer penal interest** — `penalInterest.service.ts`:
   - No penalty when `daysLate <= 0` or `daysLate <= gracePeriodDays`
     (grace is inclusive — exactly at the grace boundary is still protected).
   - Base = `ENTIRE_OUTSTANDING` principal or `OVERDUE_INSTALLMENT_ONLY` per rule.
   - Amount = fixed (`penalAmount`) or `base × penalRate%`.

Returns `{ baseInterest, effectiveRate, rateSource, penalty, penaltyApplied, totalInterest }`.

### 7.2 Repayment Schedule Engine (`modules/repayment/`)

`generateAndSaveSchedule(input)` picks a strategy from the registry and persists
the output as a **new schedule version** (old current row is superseded, never
edited):

| Strategy | Behavior |
|---|---|
| `EMI` | Standard amortization `EMI = P·r·(1+r)^n / ((1+r)^n − 1)`; moratorium months are excluded from count and schedule; last installment absorbs rounding residue; principal & interest are rounded first and `totalAmount` derived from the rounded values (prevents 1-paisa mismatches that would block SUCCESS status) |
| `BULLET` | Full principal at maturity |
| `INTEREST_ONLY` | Interest each period, principal at end |
| `STRUCTURED` | Caller-defined installment structure |
| `CUSTOM` | Aliased to the structured strategy |

### 7.3 Payment Waterfall Engine (`modules/payment/`)

`recordPayment(input)` flow:

1. Load the loan's current waterfall config; fall back to the default order
   **PENALTY → INTEREST → PRINCIPAL**.
2. `applyWaterfall(order, amounts)` exhausts each bucket in step order
   (2-decimal rounding). `SPECIFIC_TRANCHE` steps are skipped as a safe no-op
   (tranche-level application is not implemented in V1).
3. **Overflow cascade**: any unallocated remainder is applied to the loan's next
   PENDING/PARTIAL installments in due order — but **only** when the caller
   explicitly set `autoApplyOverflow` (overpayment allocation is a deliberate
   decision, never silent).
4. Persist the payment + all `payment_allocations` atomically
   (`createPaymentWithAllocations`), updating installment paid amounts/status.
5. Post double-entry journal entries via `accounting.service.recordPaymentEntries`
   (interest receipt / principal receipt / penal interest legs).
6. Return the saved payment, the aggregated waterfall result, and
   `installmentsSettled`.

### 7.4 Accounting (`modules/accounting/`, `modules/accounting-export/`)

- `accounting` posts journal entries: disbursement, write-off, and the automatic
  payment-receipt entries above. Ledger fetch per loan.
- `accounting-export` lists/export entries by category as CSV or Excel
  (exceljs), tracking `isExported`.

---

## 8. API Surface (endpoint reference)

All routes require `authenticate` (Bearer session token) unless noted.
Mounted directly on the app root (not under `/api/v1`) except borrowers/loans.

| Mount | Endpoints |
|---|---|
| `/health` | GET — liveness (public) |
| `/auth` | POST `/register`, `/login`, `/logout`, `/forgot-password`, `/reset-password` (all public) |
| `/users` | GET `/me`; GET `/` (`user:read`); POST `/` (`user:create`); PATCH `/:id/activate` · `/:id/deactivate` (admin perms) |
| `/api/v1/borrowers` | POST `/`, GET `/`, GET `/:id`, PUT `/:id`, DELETE `/:id` |
| `/api/v1/loans` | POST `/`, GET `/` (filtered list), GET `/:id`, PUT `/:id`, DELETE `/:id` |
| `/interest-rules` | POST `/` (new config revision); GET `/:loanId` (current config); POST `/:loanId/calculate`; POST `/rules`, GET `/rules/:configId`, DELETE `/rules/:ruleId`; POST `/penal-rules`, GET `/penal-rules/:loanId` |
| `/repayment-schedules` | POST `/` (generate + save revision); GET `/:loanId` (current schedule + installments) |
| `/payments` | POST `/` (record via waterfall); GET `/:loanId` (history) |
| `/accounting-entries` | POST `/disbursement`, POST `/write-off`, GET `/:loanId` (ledger) |
| `/accounting` | GET `/:category` (list), GET `/export/:category` (CSV/XLSX download) |
| `/collateral` | POST `/`; GET `/loan/:loanId`; GET `/:id`; GET `/:id/ltv`; PATCH `/:id/valuation`, `/:id/insurance`; PUT `/:id`; DELETE `/:id` |
| `/collections` | POST `/`; GET `/loan/:loanId`, `/customer/:customerId`, `/:id`; PATCH `/:id/status`, `/:id/follow-up`; POST `/:id/promise-to-pay`; PATCH `/:id/promise-to-pay/close`; PUT `/:id`; DELETE `/:id` |
| `/documents` | POST `/upload` (multipart); GET `/entity/:entityType/:entityId`; GET `/:id/signed-url`; GET `/:id` (download); DELETE `/:id` |
| `/reports` | GET `/loan-register`, `/customer-report`, `/collateral-report`, `/collections-report`, `/document-report`, `/portfolio-summary` + `/export/<same six>` |
| `/dashboard` | GET `/summary`, `/portfolio`, `/collections` |
| `/lookup` | GET `/loans`, GET `/borrowers` — minimal id+label lists for UI selects |
| dev only | GET `/reset-password` page (never mounted in production) |

---

## 9. Frontend Architecture

### 9.1 Stack & composition

React 19 SPA (Vite), React Router 7, TanStack Query for server state, Tailwind
CSS 4. Lint via oxlint. `VITE_API_BASE_URL` points at the backend.

### 9.2 Routing (`App.tsx`)

- Public: `/` (landing), `/login`, `/signup`, `/forgot-password`, `/reset-password`.
- `ProtectedRoute` (requires session) → `Layout` (nav shell) →
  `/dashboard`, `/borrowers` (+ `/new`, `/:id/edit`), `/loans` (+ `/new`, `/:id/edit`),
  `/repayment`, `/payments`, `/reports`, `/accounting`, `/accounting-entries`,
  `/collateral`, `/collections`, `/documents`.
- `AdminRoute` gate → `/admin/users`, `/admin/users/new`.

### 9.3 Data layer

- `lib/api.ts`: single `apiRequest<T>` fetch wrapper — attaches
  `Authorization: Bearer <token>` from an in-memory copy of the session token,
  normalizes errors into `ApiError { status, code, details[] }` (including
  per-field 422 details), plus `downloadFile()` for export endpoints and
  `toQueryString()` helper.
- `features/auth/AuthContext.tsx`: owns login/logout/session-restore; persists
  the opaque token to `localStorage` (`sessionToken`) and pushes it into the api
  module via `setAccessToken`.
- Each feature folder has its own `api.ts` + `types.ts` that unwrap that
  module's specific response envelope (see §4.3).

### 9.4 Feature folders

`accounting`, `accounting-entries` (journal ledger + record-entry form), `admin`
(user management), `auth`, `borrowers`, `collateral`, `collections`, `dashboard`
(charts: HorizontalBarChart, Meter, StatusLegend), `documents`, `interest`
(InterestSetup panel with config/rules/penal-rules/calculate panels), `landing`,
`loans`, `lookup` (BorrowerSelect/LoanSelect shared selects), `payments`
(RecordPaymentForm), `repayment` (GenerateScheduleForm + schedule view),
`reports`.

Notable flow: **CreateLoanPage embeds InterestSetup** — the loan master is saved
first, then the interest engine opens against the new loan id (single flow, no
separate interest tab).

---

## 10. Configuration & Environment

All env access goes through `backend/src/config/env.ts` (nothing else reads
`process.env`). Malformed config throws **at startup**.

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase transaction pooler (:6543). SSL `require`; pool max 10; **prepared statements disabled** (PgBouncer transaction mode) |
| `PORT` | — | default 3000 |
| `NODE_ENV` | — | development / production / test |
| `CORS_ORIGINS` | prod ✅ | comma-separated allow-list; empty is a startup error in production |
| `REFRESH_TOKEN_TTL_DAYS` | — | session validity window, default 7 |
| `APP_PASSWORD_RESET_URL` | — | frontend reset page the email links to |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | — | bootstrap admin for `db:seed`; published defaults MUST be overridden in real deployments |
| `SMTP_HOST/PORT/SECURE/USER/PASS/FROM` | — | optional at boot; checked at send time |
| `TWILIO_ACCOUNT_SID/AUTH_TOKEN/PHONE_NUMBER/WHATSAPP_NUMBER` | — | optional at boot; checked at send time |
| `LOG_LEVEL` | — | pino level (debug in dev, info in prod) |
| Frontend: `VITE_API_BASE_URL` | ✅ | backend base URL |

### Scripts

| Command | Purpose |
|---|---|
| backend `npm run dev` | tsx watch server (port 3000) |
| `npm run db:generate / db:migrate / db:push / db:studio` | drizzle-kit workflow |
| `npm run db:seed` | roles, permissions, grants, bootstrap admin (idempotent) |
| `npm run seed` | full demo data seed (`fullSeed.ts`) |
| `npm run typecheck` | tsc --noEmit (both packages) |
| frontend `npm run dev / build / lint` | Vite dev / build / oxlint |

---

## 11. Cross-Cutting Behaviors & Known Constraints

- **Money handling**: DB stores `numeric(18,2)`; drizzle returns these as
  strings — services convert with `Number(...)` and round to 2 dp at engine
  boundaries.
- **Soft deletes** everywhere via `deletedAt`; users are deactivated, not deleted.
- **Versioning over mutation**: interest configs, penal rules, repayment
  schedules, and waterfall configs all use the `isCurrent` revision pattern.
- **Audit & history**: `audit_logs` (jsonb old/new values) and
  `loan_status_history` capture change trails.
- **SPECIFIC_TRANCHE** waterfall steps exist in the schema but are a no-op in
  the V1 payment engine.
- **Response envelopes are inconsistent across modules** (see §4.3) — treat each
  module's shape individually.
- **Dev gotcha**: after merges, a stale backend process may still be serving old
  code on port 3000 — compare the process start time against the latest commit
  time before debugging "missing" behavior.
- The `punchlist/` folder is a standalone static HTML page, not part of the app
  build.

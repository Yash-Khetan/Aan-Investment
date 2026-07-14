
# Loan Management System (LMS)

A production-grade **Loan Management System (LMS)** developed for **Aan Finance & Investment Private Limited**, a Non-Banking Financial Company (NBFC) engaged in **secured** and **structured lending**.

Unlike traditional retail loan systems, this application is designed to handle **highly customizable loan products**, configurable business rules, and complex repayment structures while maintaining security, auditability, and scalability.

---

## Project Overview

The system is an **internal enterprise platform** for managing the complete lifecycle of loans, including:

* Borrower Management
* Loan Management
* Interest Calculation Engine
* Repayment Schedule Management
* Payment Processing
* Security & Collateral Management
* Document Vault
* Collections & Follow-ups
* Accounting Exports
* Reports & MIS
* Audit Trail
* Role-Based Access Control

It **does not** include customer-facing portals, mobile applications, or digital onboarding.

---

## Tech Stack

### Backend

* Node.js 20+
* TypeScript (strict, ESM)
* Express 5
* Drizzle ORM
* PostgreSQL (Supabase)
* `tsx` runtime

### Authentication & Security

* JWT access tokens (short-lived)
* Opaque refresh tokens with server-side sessions
* Role-Based Access Control (RBAC)
* Argon2 password hashing
* Helmet security headers
* CORS allow-listing
* Rate limiting (`express-rate-limit`)
* Zod request validation
* HTTP-only refresh cookies

### Tooling & Infrastructure

* Drizzle Kit (migrations, studio, seed)
* Pino structured logging
* Docker

---

## Folder Structure

```text
Aan-Investment/
├── README.md
├── .gitignore
└── backend/
    ├── .env.example          # Environment variable template (placeholders only)
    ├── .dockerignore
    ├── DockerFile
    ├── drizzle.config.ts     # Drizzle Kit configuration
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── app.ts            # Express app assembly (middleware + routes)
        ├── server.ts         # Process entry point, boot & graceful shutdown
        ├── config/           # Validated, typed environment configuration
        ├── common/           # Shared errors, crypto & HTML-escaping helpers
        ├── middleware/       # cors, rate limit, request logging, validation, errors
        ├── utils/            # Logger
        ├── types/            # Express type augmentation
        ├── dev/              # Dev-only helpers; never mounted in production
        │   └── resetPasswordPage.ts   # Stand-in reset page until a front-end exists
        ├── modules/          # Feature modules (one folder per domain)
        │   ├── auth/         # Authentication + authorization — the template module
        │   │   ├── auth.constants.ts
        │   │   ├── auth.types.ts             # Shared DTOs / contracts
        │   │   ├── auth.validators.ts        # Zod schemas + inferred input types
        │   │   ├── auth.repository.ts        # Data access (users, roles, sessions, resets)
        │   │   ├── auth.service.ts           # Business logic (use-case layer)
        │   │   ├── auth.controller.ts        # HTTP request handlers
        │   │   ├── auth.middleware.ts        # authenticate (JWT guard)
        │   │   ├── authorization.service.ts  # Effective-permission resolution (RBAC)
        │   │   ├── authorize.middleware.ts   # authorize / authorizeAny (RBAC guards)
        │   │   ├── auth.utils.ts             # password, token, cookie helpers
        │   │   ├── auth.routes.ts            # Route definitions
        │   │   └── index.ts                  # Public surface (routers + guards)
        │   └── notifications/  # Email / SMS / WhatsApp delivery + persistence
        │       ├── services/   # notification, email, sms, whatsapp
        │       ├── repositories/
        │       ├── types/
        │       ├── utils/      # twilio client, validators, typed errors
        │       └── index.ts    # Public surface (notificationService + types)
        └── db/
            ├── index.ts      # Postgres client & connection lifecycle
            ├── schema/       # Drizzle table definitions (per domain)
            ├── relations.ts
            ├── migrations/   # Generated SQL migrations
            └── seed/         # Seed scripts (system roles, permissions, grants)
```

---

## Setup

### Prerequisites

* [Node.js](https://nodejs.org/) v20+
* A PostgreSQL database (Supabase recommended)
* [Docker](https://www.docker.com/) (optional)

### Local setup

```bash
cd backend
npm install
cp .env.example .env   # then fill in real values — never commit .env
npm run db:migrate     # apply database migrations
npm run db:seed        # seed system roles, permissions and grants (required)
npm run dev            # start with hot reload
```

`db:seed` is **not optional**: it creates the `EMPLOYEE` and `ADMIN` roles, the permission catalogue, the role→permission grants, and the single bootstrap admin account. `POST /auth/register` resolves the default role by name, so registration fails against an unseeded database. The seed is idempotent — running it twice changes nothing, and it never resets an existing admin's password.

The seeded admin defaults to **`tonymony5678@gmail.com` / `admin@123`**. Those defaults are published here, which makes them **public knowledge** — set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `.env` before seeding anything that is not a throwaway local database. The seed warns on every run that uses the default password, and **refuses to run at all** when `NODE_ENV=production`.

The server starts on **http://localhost:3000**. A liveness probe is available at `GET /health`.

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and provide real values. **Never commit `.env`.**

Every variable is read in `src/config/env.ts` and nowhere else — no module reads `process.env` directly. Required variables are validated at boot, so a misconfigured deployment fails immediately rather than mid-request.

| Variable                     | Required | Description                                                              |
| ---------------------------- | -------- | ------------------------------------------------------------------------ |
| `NODE_ENV`                 | No       | `development` \| `production` \| `test` (default `development`). |
| `PORT`                     | No       | HTTP port (default`3000`).                                             |
| `DATABASE_URL`             | Yes      | Full PostgreSQL connection string (Supabase transaction pooler).         |
| `JWT_ACCESS_SECRET`        | Yes      | HMAC secret signing access tokens. Boot fails if under 32 chars.        |
| `JWT_ACCESS_TTL`           | No       | Access-token lifetime (default`15m`).                                  |
| `REFRESH_TOKEN_TTL_DAYS`   | No       | Refresh-token validity in days (default`7`).                           |
| `APP_PASSWORD_RESET_URL`   | No       | Base URL of the reset page; the emailed link appends `?token=…`.        |
| `SEED_ADMIN_EMAIL`         | No       | Email of the seeded admin (default`tonymony5678@gmail.com`). Seed-only. |
| `SEED_ADMIN_PASSWORD`      | No       | Password of the seeded admin (default`admin@123` — **public**). Seed-only. |
| `CORS_ORIGINS`             | Prod     | Comma-separated allowed origins. Required in production.                 |
| `LOG_LEVEL`                | No       | Pino log level (`debug` \| `info` \| `warn` \| `error`).         |
| `SMTP_HOST`                | No\*     | SMTP server host.                                                        |
| `SMTP_PORT`                | No\*     | SMTP port (`587` STARTTLS, `465` implicit TLS).                      |
| `SMTP_SECURE`              | No\*     | Implicit TLS. Defaults to `true` only when the port is 465.            |
| `SMTP_USER` / `SMTP_PASS`  | No\*     | SMTP credentials.                                                        |
| `SMTP_FROM`                | No\*     | Envelope + header `From` address.                                      |
| `TWILIO_ACCOUNT_SID`       | No\*     | Twilio account SID.                                                      |
| `TWILIO_AUTH_TOKEN`        | No\*     | Twilio auth token.                                                       |
| `TWILIO_PHONE_NUMBER`      | No\*     | E.164 sender for SMS.                                                    |
| `TWILIO_WHATSAPP_NUMBER`   | No\*     | E.164 sender for WhatsApp.                                               |
| `SUPABASE_*`               | No       | Reserved for the storage integration; not read by the runtime today.     |

\* Optional at boot so a deployment that never sends notifications still starts. The notifications module raises `ProviderConfigError` at **send time** if the channel it needs is unconfigured. Without SMTP configured, `POST /auth/forgot-password` still returns 200 — the email delivery failure is logged, never surfaced to the caller.

**There is deliberately no `JWT_REFRESH_SECRET`.** Refresh tokens are opaque random strings stored server-side, not JWTs, so there is nothing to sign.

---

## Authentication API

All auth routes are mounted under `/auth`; the current-user route under `/users`.

| Method | Endpoint                     | Auth               | Description                                                          |
| ------ | ---------------------------- | ------------------ | -------------------------------------------------------------------- |
| POST   | `/auth/register`           | Public             | Create an account with the default `EMPLOYEE` role. Issues no tokens. |
| POST   | `/auth/login`              | Public             | Authenticate with credentials; issues access token + refresh cookie. |
| POST   | `/auth/refresh`            | Refresh cookie     | Rotate the session and issue a new access token.                     |
| POST   | `/auth/logout`             | Public             | Invalidate the current session (idempotent).                         |
| POST   | `/auth/forgot-password`    | Public             | Request a password-reset token for an email.                         |
| POST   | `/auth/reset-password`     | Reset token        | Set a new password using a valid reset token.                        |
| GET    | `/users/me`                | Access token       | Return the authenticated user's profile.                             |
| GET    | `/users`                   | `user:read`      | List all users. **Admin only.**                                      |
| POST   | `/users`                   | `user:create`    | Provision an account for a colleague. **Admin only.**                |
| PATCH  | `/users/:id/activate`      | `user:activate`  | Re-enable a disabled account. **Admin only.**                        |
| PATCH  | `/users/:id/deactivate`    | `user:deactivate`| Disable an account and revoke its sessions. **Admin only.**          |

Every response shares one envelope. Success: `{ "success": true, "data": { … } }`. Failure: `{ "success": false, "error": { "message": "…", "requestId": "…" } }`, with an extra `details` array on validation errors. All failures funnel through a single global error handler.

### Module layering

Each request flows through exactly one path, and no layer skips the next:

```
auth.routes.ts  →  auth.controller.ts  →  auth.service.ts  →  auth.repository.ts
   (Zod)            (HTTP only)            (use cases)         (SQL only)
```

Routes validate shape, controllers adapt HTTP, the service owns the rules, the repository owns the SQL. No SQL above the repository; no HTTP below the controller.

### `POST /auth/register`

Body `{ firstName, lastName, email, password }`. Names are trimmed, the email is trimmed and lowercased, and the password must be 8–128 characters with at least one letter and one number. Duplicate email → **409**; malformed body → **422**.

```json
{ "success": true, "data": { "id": "…", "email": "…", "roles": ["EMPLOYEE"] } }
```

Returns **201 Created**. Registration deliberately does **not** log the user in — no access token, no refresh cookie, no session. The client calls `POST /auth/login` afterwards. The user row and its default-role grant are written in a **single transaction**, so an account can never exist without a role. The unique index on `users.email` is the authority on duplicates: a lost race between two concurrent registrations surfaces as the same 409, not a 500.

### `POST /auth/login`

Body `{ email, password }`. Returns **200** with the sanitized user and an access token in the body; the refresh token is set as an HTTP-only cookie. Unknown email and wrong password return the **same** 401 message, so accounts cannot be enumerated. A disabled account returns 403, but only after the password verifies.

### `POST /auth/refresh`

Reads the refresh token from the HTTP-only cookie (a body token is accepted as a fallback for non-browser clients). **Rotates** the session: the presented token is deleted and a brand-new token pair is issued, so a stolen-and-replayed token cannot yield fresh access. Expired or unknown tokens return 401.

### `POST /auth/logout`

Deletes the server-side session and clears the cookie. Idempotent and safe to call unauthenticated — an unknown token is a no-op that still reports success.

### `POST /auth/forgot-password`

Body `{ email }`. Always returns **200** with a generic message, whether or not the account exists — this endpoint reveals nothing. When the account does exist, a single-use token (256 bits) valid for 30 minutes is minted, its **SHA-256 hash** stored, and the raw token emailed as a link via the notifications module. The raw token lives only in the email body; it is never stored, logged, or returned over HTTP.

### `POST /auth/reset-password`

Body `{ token, newPassword }`. Validates the token's existence, expiry and single-use flag, re-hashes the new password with Argon2id, then **revokes every session** for that user so all devices must re-authenticate. Invalid, expired or already-used tokens return **400**.

### `GET /users/me`

Requires `Authorization: Bearer <access-token>`. Returns the profile behind the verified token's `sub` claim. The header must contain the raw token with no quotes and no repeated `Bearer` prefix.

---

## User Management (admin only)

Four routes, each gated by a distinct permission that only `ADMIN` holds. An authenticated `EMPLOYEE` reaching any of them gets **403**, not 401 — they are authenticated, just not permitted.

### `GET /users`

Lists every non-deleted user with their roles and `isActive` flag. Requires `user:read`.

### `POST /users`

Body `{ firstName, lastName, email, password }` — the **same** shape and the same validation as registration. Requires `user:create`. Returns **201** with the sanitized user.

The admin does not choose a role: there is no `role` field, so this endpoint cannot mint a second admin. The account is created with `EMPLOYEE`, hashed with the same Argon2id parameters, in the same single transaction that writes the user row and its role grant together. Duplicate email → **409**.

### `PATCH /users/:id/activate` · `PATCH /users/:id/deactivate`

Enable or disable an account. Require `user:activate` / `user:deactivate` respectively. A malformed `:id` fails as **422** at the route edge before it can reach Postgres. Unknown id → **404**.

Deactivation is this system's answer to deletion — reversible, and it destroys no history. Two consequences are worth knowing:

* **Sessions are revoked immediately.** Disabling an account deletes every `user_sessions` row for it, so it cannot silently keep renewing itself. Its already-issued access token still works until it expires (≤15 min) — access tokens are stateless by design — but `POST /auth/refresh` re-checks `isActive`, so the door shuts on its own and cannot be propped open. `POST /auth/login` returns 403 for a disabled account.
* **An admin may not deactivate themselves** → **400**. With a single admin account that would be an unrecoverable lockout: nobody would be left holding `user:activate` to undo it. The actor's id comes from the verified token, never the request body, so the guard cannot be spoofed.

---

## Token Model & Refresh Flow

* **Access tokens** are short-lived JWTs (HS256, default 15 minutes) carrying `{ sub, roles }` and sent in the `Authorization: Bearer <token>` header. They are stateless — verified by signature alone, with no database hit on the hot path.
* **Refresh tokens** are opaque 384-bit random strings, *not* JWTs. Only their SHA-256 hash is stored in `user_sessions`; the raw value exists solely in the client's cookie. One row per device/login.
* The refresh cookie is `httpOnly` (invisible to JavaScript, mitigating XSS token theft), `secure` in production, and scoped to `path=/auth` so the browser only sends it to the refresh and logout endpoints.

```
login    → access token (body, 15m)  +  refresh cookie (7d, httpOnly)
   ↓ access token expires
refresh  → old session row deleted, new token pair issued   ← rotation
   ↓
logout   → session row deleted, cookie cleared
```

Because refresh tokens are stored server-side, a session can be revoked instantly. Resetting a password deletes every session row for that user.

Passwords are hashed with **Argon2id** (memory-hard: 19 MiB, 2 passes), whose PHC-string output embeds the algorithm, parameters and salt — so no separate salt column exists. Reset tokens are single-use and time-bound.

---

## Role-Based Access Control (RBAC)

Authentication answers *who are you*; authorization answers *what may you do*. They are separate layers and never duplicate each other's work.

Permissions resolve through four tables: `user_roles → roles (active only) → role_permissions → permissions`. The LMS is internal to Aan Finance & Investment, so the seed defines two roles:

| Role       | Permissions                                                                                                            |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| `EMPLOYEE` | `loan:read`, `loan:create` — the default for every new account                                                          |
| `ADMIN`    | everything `EMPLOYEE` has, plus `user:read`, `user:create`, `user:update`, `user:activate`, `user:deactivate`           |

`ADMIN` **inherits every employee capability** — its grant list is literally `[...EMPLOYEE_PERMISSIONS, ...ADMIN_PERMISSIONS]` — so an admin can do anything an employee can, and additionally manage users. The reverse is not true: an employee hitting a user-management route gets a 403.

There is deliberately **no `user:delete`**. Accounts are deactivated, never destroyed, so history and audit trails survive.

Exactly **one** admin account exists, created by the seed (see [Setup](#local-setup)). It is an *ordinary user row* that happens to hold the `ADMIN` role — there is no `if (email === "admin@…")` anywhere in the codebase, and login, refresh, sessions and password hashing treat it exactly like anyone else. Nothing in `auth.routes.ts` names a role either: routes ask for *permissions*, and the seed decides who holds them. Adding a second privileged role later needs no code change outside the seed.

Registration cannot escalate privilege. Neither `POST /auth/register` nor `POST /users` accepts a `role` field, and Zod strips unknown keys — so a caller who posts `{"role":"ADMIN"}` has it silently discarded. A role can only be granted by the seed or by direct database access.

Further roles (`AUDITOR`, `CREDIT_MANAGER`, `COLLECTION_OFFICER`) are added by extending `SYSTEM_ROLES` and `ROLE_PERMISSIONS` in `backend/src/db/seed/index.ts` — the authorization layer needs no change.

#### The seed both grants and revokes

`syncRolePermissions()` makes each managed role's grants match `ROLE_PERMISSIONS` **exactly**: it inserts what is listed and *deletes what is not*. This matters, because `EMPLOYEE` previously held the whole catalogue, `user:read` included — every employee could list every user. Inserting new grants would never have undone that; only deleting the stale rows does. Roles the seed does not manage are left untouched.

Two retirements run for the same reason. `MANAGER` and `VIEWER` roles from an earlier design are dropped, with any remaining holder migrated to `EMPLOYEE` first so nobody loses access (`user_roles.role_id` has no `ON DELETE CASCADE`, so memberships must go before the role). And the coarse `user:write` permission is deleted, superseded by the finer `user:create` / `user:update` / `user:activate` / `user:deactivate`; `role_permissions.permission_id` cascades, so no role is left holding a key to a door that no longer exists. On a database that never had them, both steps are no-ops.

Guards compose on a route, `authenticate` always first:

```ts
userRouter.get("/", authenticate, authorize("user:read"), controller.listUsers);
```

`authorize(...perms)` requires **all** listed permissions; `authorizeAny(...perms)` requires **at least one**. Both reuse `req.user` from `authenticate` rather than re-parsing the token, and both resolve effective permissions from the database on each call — so revoking a role takes effect immediately instead of waiting for the access token to expire. Missing authentication yields 401; authenticated-but-unpermitted yields 403.

Role *names* are embedded in the access token for cheap display, but permission checks never trust them — they always hit the database.

---

## Notifications Integration

The auth module never talks to SMTP or Twilio directly. It imports `notificationService` from the notifications module's public surface (`src/modules/notifications/index.ts`) and calls `sendEmail(...)`.

The forgot-password flow is the current consumer. Two details matter:

* **Delivery failure is non-fatal.** If SMTP is unconfigured or down, the error is logged and the endpoint still returns its generic 200 — otherwise a delivery failure would leak which emails exist.
* **What gets persisted is tokenless.** The notification row saved to the database stores a generic message and the bare reset URL. The single-use raw token appears only in the outbound email body.

The user's first name is user-controlled and reaches an HTML email body, so it is HTML-escaped (`src/common/html.ts`) before interpolation.

---

## Running the Backend

```bash
# Development (hot reload)
npm run dev

# Production
npm start

# Type-check without emitting
npm run typecheck

# Database
npm run db:generate   # generate migrations from schema
npm run db:migrate    # apply migrations
npm run db:push       # push schema (dev)
npm run db:studio     # Drizzle Studio
npm run db:seed       # run seed script
```

### Docker

```bash
cd backend
docker build -t aan-backend .
docker run -p 3000:3000 --env-file .env aan-backend
```

---

## Project Status

**Current stage: Authentication and notifications complete.**

* Application bootstrap, configuration, logging, and graceful shutdown — implemented.
* Database layer, schema, and migrations — implemented.
* Full authentication module (register, login, refresh, logout, forgot/reset password, RBAC, session management) — implemented.
* Admin role + admin-only user management (list, create, activate, deactivate) — implemented.
* Notifications module (email, SMS, WhatsApp) with persistence — implemented.
* Borrower and Loan master modules (CRUD, validation, nested promoters/guarantors) — implemented.
* Interest engine, repayment engine, collateral, collections, documents, reports, accounting export, dashboard — implemented; see the module list under `backend/src/modules/`.

A dev-only page at `GET /reset-password` stands in for the front-end reset form. It is mounted **only** when `NODE_ENV !== "production"` and holds no business logic; delete `src/dev/` once a real front-end owns that page.

---

## Development Principles

This project follows several engineering principles:

* Clean, modular, feature-based architecture
* Separation of concerns
* Strict type safety
* Secure by default
* Configurable business rules
* Full auditability
* Production-ready standards

---

## Development Workflow

```text
main
│
├── develop
│
├── feature/auth
├── feature/borrowers
├── feature/loans
├── feature/interest-engine
├── feature/payments
├── feature/documents
└── ...
```

Feature branches are merged into `develop` before being promoted to `main`.

---

## Loan Module

The Loan Module manages **loan master data and lifecycle** only. Interest,
repayment, payments, collateral, documents, collections, reporting and
accounting are separate modules and are intentionally **not** implemented here —
the Loan Module simply stores and exposes fields such as `interestRate`,
`tenureMonths` and `repaymentType`, leaving all calculations to their owning
modules.

### Running the backend

```bash
cd backend
npm install
cp .env.example .env      # then fill in DATABASE_URL
npm run dev               # tsx watch → http://localhost:3000
```

Scripts:

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start with watch (tsx) |
| `npm start` | Start once (tsx) |
| `npm run build` / `npm run typecheck` | Type-check (`tsc --noEmit`) |
| `npm run db:generate` / `npm run db:migrate` | Drizzle Kit migrations |

On boot the server verifies the database connection (`SELECT 1`) and logs
`Database connected` before accepting requests.

### Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres / Supabase connection string |
| `NODE_ENV` | no | `development` \| `test` \| `production` (default `development`) |
| `PORT` | no | HTTP port (default `3000`) |

Placeholders live in `backend/.env.example`. **Never commit `.env`** — it is
gitignored.

### API

Base path: **`/api/v1`**. Health check: `GET /health`.

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/v1/loans` | Create a loan |
| GET | `/api/v1/loans` | List (pagination, filtering, search, sorting) |
| GET | `/api/v1/loans/:id` | Get a loan by id |
| PUT | `/api/v1/loans/:id` | Update a loan |
| DELETE | `/api/v1/loans/:id` | Soft-delete a loan |

List query parameters: `page`, `limit`, `sortBy`, `sortOrder`, `search`,
`status`, `loanType`, `securityType`, `borrowerId`, `relationshipManagerId`,
`minSanctionedAmount`, `maxSanctionedAmount`, `sanctionDateFrom`,
`sanctionDateTo`.

Response envelope: `{ success, data, meta? }` on success;
`{ success: false, error: { code, message, details? } }` on error.

### Borrower API

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/v1/borrowers` | Create a borrower (optional `promoters[]` / `guarantors[]`, inserted transactionally) |
| GET | `/api/v1/borrowers` | List (pagination, filtering, search, sorting) |
| GET | `/api/v1/borrowers/:id` | Get a borrower with its promoters and guarantors |
| PUT | `/api/v1/borrowers/:id` | Update borrower master fields |
| DELETE | `/api/v1/borrowers/:id` | Soft-delete a borrower |

Borrower list parameters: `page`, `limit`, `sortBy`, `sortOrder`, `search`
(name / code / PAN / GST), `status`, `constitution`, `relationshipManagerId`.

### Backend module structure

```text
backend/src/
├── app.ts            Express app factory
├── server.ts         HTTP bootstrap + DB health check
├── config/env.ts     Validated environment config
├── common/           errors, http helpers, middleware (validate, errorHandler)
├── routes/index.ts   /api/v1 aggregator
└── modules/
    ├── loan/         controller · service · repository · routes · validators · types · constants
    └── borrower/     controller · service · repository · routes · validators · types · constants
```

---

## Future Enhancements

* Email Notifications
* WhatsApp Reminders
* Advanced Analytics Dashboard
* Rule Engine UI
* Multi-Tenant Support
* Cloud Object Storage Migration
* Monitoring & Observability

---

## License

Proprietary software developed for **Aan Finance & Investment Private Limited**. Unauthorized distribution, reproduction, or commercial use is prohibited.

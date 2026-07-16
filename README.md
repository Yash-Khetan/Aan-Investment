
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

* Opaque session tokens (server-side sessions, no JWT)
* Bearer-token authentication, validated against the database on every request
* Role-Based Access Control (RBAC)
* Argon2 password hashing
* Helmet security headers
* CORS allow-listing
* Rate limiting (`express-rate-limit`)
* Zod request validation

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
| `REFRESH_TOKEN_TTL_DAYS`   | No       | Session-token validity in days (default`7`).                           |
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

**There is deliberately no signing secret.** Session tokens are opaque random strings stored server-side, not JWTs, so there is nothing to sign — a token is validated by matching its SHA-256 hash against `user_sessions`.

---

## Authentication API

All auth routes are mounted under `/auth`; the current-user route under `/users`.

| Method | Endpoint                     | Auth               | Description                                                          |
| ------ | ---------------------------- | ------------------ | -------------------------------------------------------------------- |
| POST   | `/auth/register`           | Public             | Create an account with the default `EMPLOYEE` role. Issues no token.  |
| POST   | `/auth/login`              | Public             | Authenticate with credentials; issues the session token in the body. |
| POST   | `/auth/logout`             | Bearer token       | Invalidate the current session (idempotent).                         |
| POST   | `/auth/forgot-password`    | Public             | Request a password-reset token for an email.                         |
| POST   | `/auth/reset-password`     | Reset token        | Set a new password using a valid reset token.                        |
| GET    | `/users/me`                | Bearer token       | Return the authenticated user's profile.                             |
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

Returns **201 Created**. Registration deliberately does **not** log the user in — no token, no session. The client calls `POST /auth/login` afterwards. The user row and its default-role grant are written in a **single transaction**, so an account can never exist without a role. The unique index on `users.email` is the authority on duplicates: a lost race between two concurrent registrations surfaces as the same 409, not a 500.

### `POST /auth/login`

Body `{ email, password }`. Returns **200** with the sanitized user and the session token in the body (`data.token`). The client stores this token and sends it as `Authorization: Bearer <token>` on every subsequent request; it IS the credential. Unknown email and wrong password return the **same** 401 message, so accounts cannot be enumerated. A disabled account returns 403, but only after the password verifies.

```json
{ "success": true, "data": { "user": { … }, "token": "…" } }
```

### `POST /auth/logout`

Reads the session token from the `Authorization: Bearer` header and deletes the matching server-side session. Idempotent and safe to call without a valid token — an unknown or missing token is a no-op that still reports success.

### `POST /auth/forgot-password`

Body `{ email }`. Always returns **200** with a generic message, whether or not the account exists — this endpoint reveals nothing. When the account does exist, a single-use token (256 bits) valid for 30 minutes is minted, its **SHA-256 hash** stored, and the raw token emailed as a link via the notifications module. The raw token lives only in the email body; it is never stored, logged, or returned over HTTP.

### `POST /auth/reset-password`

Body `{ token, newPassword }`. Validates the token's existence, expiry and single-use flag, re-hashes the new password with Argon2id, then **revokes every session** for that user so all devices must re-authenticate. Invalid, expired or already-used tokens return **400**.

### `GET /users/me`

Requires `Authorization: Bearer <session-token>`. Returns the profile behind the session the token resolves to. The header must contain the raw token with no quotes and no repeated `Bearer` prefix.

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

* **Sessions are revoked immediately.** Disabling an account deletes every `user_sessions` row for it. Because every request is validated against that table, the account is locked out at once — there are no rows left to match, so the very next request gets a 401. `POST /auth/login` returns 403 for a disabled account.
* **An admin may not deactivate themselves** → **400**. With a single admin account that would be an unrecoverable lockout: nobody would be left holding `user:activate` to undo it. The actor's id comes from the authenticated session, never the request body, so the guard cannot be spoofed.

---

## Session-Token Model

Authentication is session-based: there is a single token, and it is the credential.

* **Session tokens** are opaque 384-bit random strings, *not* JWTs. Login returns the raw token in the response body; the client stores it and sends it as `Authorization: Bearer <token>` on every request. Only the token's SHA-256 hash is stored in `user_sessions` — the raw value is never persisted, logged, or returned again. One row per device/login.
* **Every request is validated against the database.** `authenticate` hashes the presented token, looks up the session row, checks it has not expired, confirms the owner still exists and is active, and loads the owner's roles fresh. There is no stateless fast path — which is precisely what makes a session instantly revocable.
* **Default lifetime is 7 days** (`REFRESH_TOKEN_TTL_DAYS`), fixed at login. There is no per-request rotation and no sliding renewal: an active user re-authenticates once the window elapses.

```
login    → session token (body, 7d)     ← client stores it, sends as Bearer
   ↓  every request: Bearer <token> → hash → match user_sessions → check expiry + isActive → load roles
logout   → session row deleted           ← Bearer token identifies the row
```

Because tokens are stored server-side, a session can be revoked instantly: deactivating an account or resetting a password deletes every session row for that user, and the next request with an orphaned token gets a 401.

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

`authorize(...perms)` requires **all** listed permissions; `authorizeAny(...perms)` requires **at least one**. Both reuse `req.user` from `authenticate` rather than re-validating the token, and both resolve effective permissions from the database on each call — so revoking a role takes effect on the user's next request. Missing authentication yields 401; authenticated-but-unpermitted yields 403.

Role *names* are loaded onto `req.user` for cheap display, but permission checks never trust them — they always hit the database.

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
* Core lending domain modules (borrowers, loans, interest, repayments, collections, reporting) — planned, built incrementally on this foundation.

A dev-only page at `GET /reset-password` stands in for the front-end reset form. It is mounted **only** when `NODE_ENV !== "production"` and holds no business logic; delete `src/dev/` once a real front-end owns that page.

---

## Development Principles

* Clean, modular, feature-based architecture
* Strict type safety
* Secure by default
* Configurable business rules
* Full auditability
* Production-ready standards

---

## License

Proprietary software developed for **Aan Finance & Investment Private Limited**. Unauthorized distribution, reproduction, or commercial use is prohibited.

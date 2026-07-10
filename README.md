
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

`db:seed` is **not optional**: it creates the `MANAGER` and `VIEWER` roles and the permission catalogue. `POST /auth/register` resolves the default role by name, so registration fails against an unseeded database. The seed is idempotent — running it twice changes nothing.

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

| Method | Endpoint                  | Auth           | Description                                                          |
| ------ | ------------------------- | -------------- | -------------------------------------------------------------------- |
| POST   | `/auth/register`        | Public         | Create an account with the default `VIEWER` role. Issues no tokens.  |
| POST   | `/auth/login`           | Public         | Authenticate with credentials; issues access token + refresh cookie. |
| POST   | `/auth/refresh`         | Refresh cookie | Rotate the session and issue a new access token.                     |
| POST   | `/auth/logout`          | Public         | Invalidate the current session (idempotent).                         |
| POST   | `/auth/forgot-password` | Public         | Request a password-reset token for an email.                         |
| POST   | `/auth/reset-password`  | Reset token    | Set a new password using a valid reset token.                        |
| GET    | `/users/me`             | Access token   | Return the authenticated user's profile.                             |
| GET    | `/users`                | `user:read`  | List all users. RBAC-protected.                                      |

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
{ "success": true, "data": { "id": "…", "email": "…", "roles": ["VIEWER"] } }
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

Permissions resolve through four tables: `user_roles → roles (active only) → role_permissions → permissions`. The seed defines two system roles:

| Role      | Permissions                                             |
| --------- | ------------------------------------------------------- |
| `MANAGER` | `user:read`, `user:write`, `loan:read`, `loan:create` |
| `VIEWER`  | `user:read`, `loan:read` — the default for new accounts |

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

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
    ├── .env.example          # Environment variable template (no secrets)
    ├── .dockerignore
    ├── DockerFile
    ├── drizzle.config.ts     # Drizzle Kit configuration
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── app.ts            # Express app assembly (middleware + routes)
        ├── server.ts         # Process entry point, boot & graceful shutdown
        ├── config/           # Validated, typed environment configuration
        ├── common/           # Shared errors & crypto helpers
        ├── middleware/       # cors, rate limit, request logging, validation, errors
        ├── utils/            # Logger
        ├── types/            # Express type augmentation
        ├── auth/             # Authentication module
        │   ├── constants.ts
        │   ├── controllers/  # Request handlers
        │   ├── services/     # Auth business logic
        │   ├── repositories/ # Data access (users, roles, sessions, resets)
        │   ├── routes/       # Route definitions
        │   ├── middleware/    # authenticate (JWT guard)
        │   ├── validators/    # Zod schemas
        │   ├── utils/         # password, token, cookie helpers
        │   └── types/
        └── db/
            ├── index.ts      # Postgres client & connection lifecycle
            ├── schema/       # Drizzle table definitions (per domain)
            ├── relations.ts
            ├── migrations/   # Generated SQL migrations
            └── seed/         # Seed scripts
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
cp .env.example .env   # then fill in real values
npm run db:migrate     # apply database migrations
npm run dev            # start with hot reload
```

The server starts on **http://localhost:3000**. A liveness probe is available at `GET /health`.

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and provide real values. **Never commit `.env`.**

| Variable                   | Required | Description                                                        |
| -------------------------- | -------- | ------------------------------------------------------------------ |
| `NODE_ENV`                 | No       | `development` \| `production` \| `test` (default `development`).    |
| `PORT`                     | No       | HTTP port (default `3000`).                                        |
| `DATABASE_URL`             | Yes      | Full PostgreSQL connection string (Supabase transaction pooler).   |
| `SUPABASE_URL`             | No       | Supabase project URL.                                              |
| `SUPABASE_PUBLISHABLE_KEY` | No       | Supabase publishable (anon) key.                                   |
| `SUPABASE_SECRET_KEY`      | No       | Supabase secret (service) key.                                     |
| `SUPABASE_JWKS_URL`        | No       | Supabase JWKS endpoint.                                            |
| `JWT_ACCESS_SECRET`        | Yes      | HMAC secret signing access tokens (min 32 chars).                  |
| `JWT_ACCESS_TTL`           | No       | Access-token lifetime (default `15m`).                             |
| `REFRESH_TOKEN_TTL_DAYS`   | No       | Refresh-token validity in days (default `7`).                      |
| `CORS_ORIGINS`             | Prod     | Comma-separated allowed origins. Required in production.           |
| `LOG_LEVEL`                | No       | Pino log level (`debug` \| `info` \| `warn` \| `error`).           |

---

## Authentication API

All auth routes are mounted under `/auth`; the current-user route under `/users`.

| Method | Endpoint                | Auth            | Description                                             |
| ------ | ----------------------- | --------------- | ------------------------------------------------------ |
| POST   | `/auth/login`           | Public          | Authenticate with credentials; issues access token + refresh cookie. |
| POST   | `/auth/refresh`         | Refresh cookie  | Rotate the session and issue a new access token.       |
| POST   | `/auth/logout`          | Public          | Invalidate the current session (idempotent).           |
| POST   | `/auth/forgot-password` | Public          | Request a password-reset token for an email.           |
| POST   | `/auth/reset-password`  | Reset token     | Set a new password using a valid reset token.          |
| GET    | `/users/me`             | Access token    | Return the authenticated user's profile.               |

**Token model**

* **Access tokens** are short-lived JWTs sent in the `Authorization: Bearer <token>` header.
* **Refresh tokens** are opaque random strings stored server-side as sessions and delivered to the browser as an HTTP-only cookie; refresh rotates the session.
* Passwords are hashed with **Argon2**; reset tokens are single-use and time-bound.

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

**Current stage: Authentication infrastructure complete.**

* Application bootstrap, configuration, logging, and graceful shutdown — implemented.
* Database layer, schema, and migrations — implemented.
* Full authentication module (login, refresh, logout, password reset, RBAC, session management) — implemented.
* Core lending domain modules (borrowers, loans, interest, repayments, collections, reporting) — planned, built incrementally on this foundation.

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

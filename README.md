# Loan Management System (LMS)

A production-grade **Loan Management System (LMS)** being developed for **Aan Finance & Investment Private Limited**, a Non-Banking Financial Company (NBFC) engaged in **secured** and **structured lending**.

Unlike traditional retail loan management systems, this application is designed to handle **highly customizable loan products**, configurable business rules, and complex repayment structures while maintaining security, auditability, and scalability.

---

## Project Overview

The system serves as an **internal platform** for managing the complete lifecycle of loans, including:

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

This is an **internal enterprise application** and **does not include** customer-facing portals, mobile applications, or digital onboarding.

---

## Tech Stack

### Backend

* Node.js
* TypeScript
* Express.js
* Drizzle ORM
* PostgreSQL (Supabase)

### Authentication & Security

* JWT Authentication
* Role-Based Access Control (RBAC)
* Argon2 Password Hashing
* HTTPS / SSL
* Rate Limiting
* Input Validation

### Infrastructure

* Supabase PostgreSQL
* Redis
* BullMQ (Background Jobs)
* Docker
* Nginx
* GitHub Actions (Planned)

### Storage

* Supabase Storage (Initial)
* AWS S3 / Cloudflare R2 (Future Support)

---

## Planned Features

### Borrower Management

* Borrower Profiles
* Promoters
* Guarantors
* Internal Ratings
* Relationship Managers

### Loan Management

* Secured & Unsecured Loans
* Multiple Loan Tranches
* Loan Lifecycle Tracking
* Structured Lending

### Interest Engine

* Multiple Interest Calculation Methods
* Step-Up / Step-Down Interest
* Event-Based Interest Changes
* Penal Interest Rules
* Custom Interest Formula Support

### Repayment Engine

* EMI Loans
* Bullet Repayment
* Interest-Only Loans
* Moratorium Periods
* Custom Repayment Schedules
* Schedule Versioning

### Security Management

* Property Details
* Mortgage Information
* Insurance Tracking
* LTV Monitoring
* CERSAI & ROC Charge Records

### Collections

* Follow-up Tracking
* Promise-to-Pay Records
* Automated Reminder Scheduling

### Reporting

* Portfolio MIS
* Loan Statements
* Interest Accrual Reports
* Collection Reports
* NPA Reports
* Excel & PDF Export

### Accounting

* Journal Entry Generation
* Tally-Compatible Export

---

## Project Status

🚧 **Current Stage:** Initial Project Setup

The repository currently contains the foundational architecture and project structure. Core modules and business logic will be implemented incrementally.

Development will follow a modular, feature-based architecture with an emphasis on maintainability, security, and scalability.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [Docker](https://www.docker.com/) (optional, for containerized setup)

### Local Setup

```bash
cd backend
npm install
node index.js
```

The server will start on **http://localhost:3000**.

> **Note:** Create a `.env` file in the `backend/` directory with the required environment variables (e.g., `DATABASE_URL`).

### Docker Setup

#### Build the image

```bash
cd backend
docker build -t aan-backend .
```

#### Run the container

```bash
docker run -p 3000:3000 --env-file .env aan-backend
```

Or pass environment variables directly:

```bash
docker run -p 3000:3000 -e DATABASE_URL="your_connection_string" aan-backend
```

#### Interactive shell (debug)

```bash
docker run -it aan-backend sh
```

---

## Repository Structure

```text
backend/
├── src/
│   ├── config/
│   ├── db/
│   ├── common/
│   ├── modules/
│   ├── jobs/
│   ├── routes/
│   ├── app.ts
│   └── server.ts
│
├── tests/
├── docs/
└── scripts/
```

---

## Development Principles

This project follows several engineering principles:

* Clean Architecture
* Modular Design
* Separation of Concerns
* Type Safety
* Secure by Default
* Configurable Business Rules
* Auditability
* Production-Ready Code Standards

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

This repository contains proprietary software developed for **Aan Finance & Investment Private Limited**.

Unauthorized distribution, reproduction, or commercial use is prohibited.

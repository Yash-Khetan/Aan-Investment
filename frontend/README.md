# Frontend — Aan Investment LMS

A React + TypeScript UI over the `dev-c-integration` backend. Built to be genuinely
working end-to-end against the real API — every page reads and writes through the
actual backend routes, no mock data.

## Tech Stack

- [Vite](https://vite.dev/) + React 19 + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com/) (via `@tailwindcss/vite`, no separate config file needed)
- [react-router-dom](https://reactrouter.com/) for routing
- [@tanstack/react-query](https://tanstack.com/query) for server state (fetching, caching, mutations)
- Plain `fetch` — no axios, no generated client. One small wrapper in `src/lib/api.ts`.

## Getting Started

```bash
cd frontend
npm install
cp .env.example .env   # defaults to http://localhost:3000, edit if your backend runs elsewhere
npm run dev
```

Opens on `http://localhost:5173`. The backend must be running separately
(`cd backend && npm run dev`, listening on `:3000`) — this app makes real HTTP calls
to it, there is no bundled mock server.

If the database looks empty, seed it first: `cd backend && npm run seed`.

```bash
npm run build      # tsc -b && vite build -> dist/
npm run typecheck  # tsc --noEmit
npm run lint       # oxlint
```

## Project Structure

```text
frontend/src/
├── main.tsx              React root: QueryClientProvider + BrowserRouter + App
├── App.tsx                Route table
├── vite-env.d.ts           import.meta.env typing (VITE_API_BASE_URL)
├── lib/
│   ├── api.ts              Shared fetch wrapper: apiRequest, downloadFile, ApiError, toQueryString
│   └── format.ts           formatCurrency / formatDate / formatNumber (en-IN locale)
├── components/
│   ├── Layout.tsx           Sidebar nav + PageHeader
│   └── ui/                  Card, StatCard, Badge, Button, Table, Field (Text/Select/TextArea), States
└── features/
    ├── dashboard/            GET /dashboard/summary
    ├── reports/              GET /reports/:report, /reports/export/:report
    ├── accounting/           GET /accounting/:category, /accounting/export/:category
    ├── collateral/           /collateral/*  (create, list, valuation, insurance, LTV, delete)
    ├── collections/          /collections/*  (create, list, status, Promise to Pay)
    ├── documents/            /documents/*  (upload, list, download, delete)
    └── lookup/               Loan/Borrower picker — see "The Lookup Endpoints" below
```

Each `features/<name>/` folder is self-contained: `types.ts` (mirrors the backend's
response shapes), `api.ts` (typed fetch calls), the page component, and a `components/`
subfolder for anything the page needs that isn't reused elsewhere. Every feature folder
has its own `README.md` — see there for that page's exact API contract and any
backend-specific quirks it works around.

## How Pages Talk to the Backend

Every feature's `api.ts` calls `apiRequest<T>(path, init)` from `lib/api.ts`, which:

- Prefixes `path` with `VITE_API_BASE_URL`
- Sets `Content-Type: application/json` automatically (skipped for `FormData` bodies,
  so file uploads work without manual header juggling)
- Throws a typed `ApiError` (with `.status` and `.code`) on any non-2xx response, parsed
  from the backend's `{ error: { code, message } }` shape where present

**The backend is not consistent about response shape across modules** — `reports`,
`accounting-export`, and `dashboard/summary` wrap results in `{ success, data, ... }`;
`collateral`, `collections`, and `document-vault` return the resource directly with no
wrapper. `apiRequest` only handles transport — each feature's own `api.ts`/`types.ts`
unwraps whatever shape that specific module actually returns. If you add a new feature,
check the backend module's own README for its actual response shape rather than
assuming it matches an existing one.

CSV/XLSX exports go through `downloadFile(path, fallbackFilename)` instead of
`apiRequest` — it reads the response as a blob and triggers a real browser download,
using the filename from the backend's `Content-Disposition` header when present.

## The Lookup Endpoints (`features/lookup/`)

None of the six backend modules expose a loan or borrower **id** alongside a
human-readable label — `reports`' loan-register, for instance, returns
`loanAccountNumber` but never the underlying UUID. `collateral`, `collections`, and
`document-vault` all require a real loan/borrower UUID as input, so without a lookup
there was no way for any form in this app to know which UUID a given loan actually is.

To fix this, two small read-only endpoints were added directly to the backend (not part
of any of the six feature modules — see `backend/src/routes/lookup.routes.ts`):

- `GET /lookup/loans` → `{ id, loanAccountNumber, customerName, status, outstandingPrincipal }[]`
- `GET /lookup/borrowers` → `{ id, borrowerCode, name }[]`

`features/lookup/LoanSelect.tsx` and `BorrowerSelect.tsx` wrap these in a `<select>`
used by Collateral, Collections, and Documents to pick "which loan/borrower" before
showing that entity's data.

## Known Limitations

- **Documents entity picker** only supports `LOAN` and `BORROWER` (not `PROPERTY`,
  `PROMOTER`, `GUARANTOR`) — those entity types exist in the schema's
  `document_owner` enum but have no lookup source of their own to pick from.
- **No auth.** The backend has no auth middleware wired up yet (see backend's own
  README, "Known Quirks"), so neither does this app — every page is reachable with no
  login.
- **`branchId`** is not exposed as a filter anywhere in this UI: no `branches` table
  exists in the schema, and both `reports` and `accounting-export` either reject or
  no-op it server-side (see each module's own backend README).

# Mini ERP + CRM Operations Portal

A small ERP/CRM system for a wholesale/distribution company covering authentication with
roles, customer CRM, product & inventory management, and a sales challan workflow with
stock-reduction business logic.

## Tech Stack

- **Backend:** Node.js, TypeScript, Express, Prisma ORM, PostgreSQL, JWT auth, Zod validation
- **Frontend:** React, TypeScript, Vite, React Router, Axios (plain CSS, no UI framework)
- **Deployment:** Render (backend) or Railway, Vercel/Netlify (frontend), Neon/Supabase (Postgres)

## Architecture (short explanation)

```
frontend (React SPA) --HTTPS--> backend (Express REST API) --Prisma--> PostgreSQL
```

- The frontend is a pure SPA (Vite build, static hosting). It never talks to the database
  directly — everything goes through the REST API.
- The backend is a single Express app. Routes are split by module (`auth`, `customers`,
  `products`, `challans`). Each route file owns its own Zod validation schemas.
- **Auth:** JWT issued on login, verified by `requireAuth` middleware on every protected
  route. `requireRole(...)` restricts specific actions (e.g. only Admin/Sales can create
  customers; only Admin/Warehouse can adjust stock).
- **Business logic lives in the challan routes**, wrapped in `prisma.$transaction` so stock
  deduction and the challan/stock-movement records are atomic — either everything commits or
  nothing does. Stock is re-checked for sufficiency immediately before the transaction to
  avoid negative stock.
- **Product snapshotting:** when a challan item is created, the product's name, SKU, and
  unit price are copied onto the `ChallanItem` row (`*Snapshot` fields) in addition to the
  live `productId` foreign key — so historical challans stay accurate even if a product is
  later renamed or repriced.
- **Stock movement log:** every stock change (manual adjustment or automatic deduction from
  a confirmed challan) writes a `StockMovement` row with type (IN/OUT), reason, and who did
  it, giving a full audit trail.

## Repository Structure

```
mini-erp-crm/
├── backend/          Express + TypeScript API
│   ├── prisma/        schema.prisma, seed.ts
│   └── src/
│       ├── routes/     auth.ts, customers.ts, products.ts, challans.ts
│       ├── middleware/ auth.ts (JWT + roles), errorHandler.ts
│       └── utils/      pagination.ts
├── frontend/          React + TypeScript (Vite)
│   └── src/
│       ├── pages/      Login, Customers, CustomerDetail, Products, Challans
│       ├── components/ Layout, ProtectedRoute
│       ├── context/    AuthContext
│       └── api/        axios client
└── postman_collection.json
```

## Beyond the Brief

A few things added on top of the required modules, since they were cheap given the existing
data model and materially improve reviewability:

- **Unit tests** (`backend/src/utils/stockLogic.ts` + `__tests__/stockLogic.test.ts`) — the
  stock-sufficiency and stock-movement rules are pulled out into pure functions and tested
  directly (no DB needed). Run with `npm test` inside `backend/`.
- **Docker Compose** — `docker compose up` from the repo root starts Postgres + the API with
  zero manual setup (see below).
- **Dashboard** (`GET /dashboard/summary` + a UI page) — customer/product/challan counts,
  low-stock alerts, and this month's revenue from confirmed challans.
- **PDF export** — `GET /challans/:id/pdf` streams a generated invoice PDF for any challan
  (the "Export invoice as PDF" bonus item from the brief).
- **CI** (`.github/workflows/ci.yml`) — GitHub Actions builds both apps and runs the test
  suite on every push/PR.

## Running Locally

### Option A — Docker Compose (fastest)

```bash
docker compose up --build
```

This starts Postgres and the backend together. Then, in a separate terminal, run migrations
and seed once:

```bash
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npm run seed
```

Backend is now on `http://localhost:4000`. Start the frontend separately (Vite doesn't need
containerizing for local dev):

```bash
cd frontend && cp .env.example .env && npm install && npm run dev
```

### Option B — Manual setup

### Prerequisites
- Node.js 18+
- A PostgreSQL database — easiest is a free instance on [Neon](https://neon.tech) or
  [Supabase](https://supabase.com); or run Postgres locally / via Docker.

### 1. Backend

```bash
cd backend
cp .env.example .env
# edit .env: set DATABASE_URL to your Postgres connection string, set a JWT_SECRET
npm install
npx prisma migrate dev --name init   # creates tables
npm run seed                         # creates one login per role
npm run dev                          # starts API on http://localhost:4000
```

Seeded accounts (password for all: `Password123!`):
| Role | Email |
|---|---|
| Admin | admin@erp.test |
| Sales | sales@erp.test |
| Warehouse | warehouse@erp.test |
| Accounts | accounts@erp.test |

### 2. Frontend

```bash
cd frontend
cp .env.example .env   # VITE_API_URL should point at the backend, e.g. http://localhost:4000
npm install
npm run dev             # starts on http://localhost:5173
```

Log in with any seeded account above. Try it end-to-end:
1. Add a product (Products page) with some minimum stock.
2. Use "Stock movement" (IN) to give it opening stock.
3. Add a customer.
4. Create a Sales Challan for that customer with that product, and Confirm it — watch the
   stock drop and a StockMovement (OUT) record get created.
5. Try confirming a challan with a quantity greater than available stock — you should get a
   clear 400 error instead of the stock going negative.
6. Click "PDF" on a challan to download the generated invoice.
7. Check the Dashboard page for live counts and the low-stock alert.

### Running tests

```bash
cd backend
npm test
```

## Environment Variables

**Backend (`backend/.env`)**
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | Secret used to sign JWTs — use a long random string in production |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `8h` |
| `PORT` | Port the API listens on (default 4000) |
| `CORS_ORIGIN` | Allowed frontend origin, e.g. your Vercel URL |

**Frontend (`frontend/.env`)**
| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Base URL of the deployed backend API |

## Deployment Guide

### Database — Neon (free)
1. Create a project at neon.tech, copy the connection string into `DATABASE_URL`.

### Backend — Render (free web service)
1. Push this repo to GitHub.
2. On Render: New → Web Service → connect the repo, set **Root Directory** to `backend`.
3. Build command: `npm install && npx prisma generate && npm run build`
4. Start command: `npm run prisma:deploy && npm start`
5. Add environment variables from the table above (`DATABASE_URL`, `JWT_SECRET`,
   `JWT_EXPIRES_IN`, `CORS_ORIGIN` — set this to your Vercel frontend URL once deployed).
6. After first deploy, run `npm run seed` once via Render's shell (or a one-off job) to
   create the four role logins.

### Frontend — Vercel
1. New Project → import the repo → set **Root Directory** to `frontend`.
2. Framework preset: Vite.
3. Environment variable: `VITE_API_URL` = your Render backend URL.
4. Deploy.

### AWS (bonus, optional)
Not deployed for this submission — treated as bonus per the assignment. The same Docker
image described below could be pushed to ECR and run on an EC2 instance or App Runner, with
RDS Postgres in place of Neon; this was deprioritized in favor of finishing all four core
modules within the 48-hour window.

## Assumptions Made

- One user per role was enough for evaluation (`seed.ts`); no self-service signup — user
  creation is out of scope for a 48h internal-tools assignment.
- "Add multiple products" on a challan means: pick a product from a dropdown per line, add
  as many lines as needed, no duplicate-product merging (each line is independent).
- Challan numbering is a simple incrementing `CH-<year>-<sequence>` scheme, adequate for a
  small operation; a high-concurrency system would need a DB sequence instead of `count()`.
- "Edit product" does not allow directly editing `stock` — stock only changes through the
  logged Stock Movement endpoint, so there's always an audit trail.
- Cancelling is only allowed on Draft challans; cancelling a Confirmed challan would need a
  proper stock-return flow, which is noted as a known limitation below rather than guessed at.

## Known Limitations / Incomplete Parts

- No AWS deployment (bonus, not attempted — see above).
- No Docker/GitHub Actions setup, no PDF export, no S3 image upload (all listed as bonus in
  the brief).
- No automated tests (unit/integration) — validated manually via the Postman collection.
- Reports/dashboards (sales totals, top customers, etc.) are not part of the brief's
  required modules and were not built.
- Minimal frontend polish (no toast notifications, no client-side form-level error
  highlighting beyond a single error banner) in favor of finishing all four required backend
  modules correctly.

## API Reference

See `postman_collection.json` for every endpoint with example bodies. Base routes:

```
POST   /auth/login
GET    /auth/me

GET    /customers              ?search=&status=&page=&limit=
POST   /customers
GET    /customers/:id
PUT    /customers/:id
POST   /customers/:id/followups

GET    /products                ?search=&lowStock=&page=&limit=
POST   /products
GET    /products/:id
PUT    /products/:id
POST   /products/:id/stock-movement

GET    /challans                 ?status=&customerId=&page=&limit=
POST   /challans                 { customerId, items[], status? }
GET    /challans/:id
PATCH  /challans/:id/confirm
PATCH  /challans/:id/cancel
```

All protected routes require `Authorization: Bearer <token>` from `/auth/login`.

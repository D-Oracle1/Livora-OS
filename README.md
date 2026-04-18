# Livora OS

<div align="center">

[![NestJS](https://img.shields.io/badge/NestJS-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?logo=postgresql&logoColor=white)](https://supabase.com/)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com/)

</div>

## Overview

Livora OS is an enterprise-grade, multi-tenant PropTech SaaS platform for Nigerian real estate companies. Each company (tenant) gets a fully isolated instance — users, properties, sales, HR, and financials are all scoped per tenant. A global Super Admin panel manages all tenants from a single interface.

Currency: **Nigerian Naira (₦ / NGN)** throughout all interfaces and reports.

---

## Architecture

### Multi-Tenancy

- **Master database** (Supabase): stores company records and `databaseUrl` per tenant
- **Per-tenant schema**: each tenant gets its own PostgreSQL schema (via `?schema=tenant_slug` in the connection URL)
- `TenantPrismaService` resolves the correct Prisma client per request from a JWT-embedded `companyId`
- New tenant provisioning runs `prisma/tenant-schema.sql` against the new schema

### Applications

| App | Description | Deploy |
|-----|-------------|--------|
| `backend/` | NestJS REST API — all business logic | Vercel (`npx vercel --prod` from `backend/`) |
| `frontend/` | Next.js 16 — tenant-facing dashboard (all roles) | Vercel (`npx vercel --prod` from root) |
| `super-admin/` | Standalone Next.js app — global Super Admin panel | Vercel (`npx vercel --prod` from `super-admin/`) |

---

## Tech Stack

### Backend
- **NestJS** with TypeScript
- **Prisma ORM** (v5) — two schemas: `master.prisma` (companies) + `schema.prisma` (tenant)
- **PostgreSQL** on Supabase (session-mode URL for DDL, transaction-mode pooler for queries)
- **Redis** — in-memory cache (`CacheService`) with TTL per endpoint
- **JWT** authentication + role-based guards
- **Socket.IO** — real-time chat and notifications
- **Nodemailer** — transactional email
- **Swagger/OpenAPI** — `/api/docs`

### Frontend
- **Next.js 16** (App Router, `--webpack` build)
- **Tailwind CSS** + **ShadCN UI** components
- **Framer Motion** — animations
- **Recharts** — charts
- **Zustand** — global auth state
- **PWA** support (service worker via `next-pwa`)

### Super Admin
- **Standalone Next.js** app (independent auth, own `package.json`)
- Connects to the same backend API with a super-admin JWT
- Pages: Dashboard, Companies, Analytics, Notifications, Settings

---

## Features

### User Roles
| Role | Description |
|------|-------------|
| `SUPER_ADMIN` | Global platform admin — manages all tenants |
| `ADMIN` | Tenant admin — full access within their company |
| `GENERAL_OVERSEER` | Read-only leadership view of all financial/HR data |
| `REALTOR` | Sales agent — manages own sales, clients, commission |
| `CLIENT` | Property buyer — views properties, payments, documents |
| `STAFF` | Internal team — attendance, payslips, tasks |
| `HR` | HR manager — payroll, attendance, leave |

### Financial Engine (General Ledger)

All financial reporting uses a **double-entry general ledger** (`general_ledger` table) as the single source of truth.

| Entry Type | Description |
|------------|-------------|
| `SALE_PAYMENT` | Cash received from a sale (FULL plan: on sale; INSTALLMENT: per payment) |
| `COMMISSION` | Commission earned on a sale |
| `COMMISSION_PAYOUT` | Commission paid out to a realtor |
| `TAX` | Tax deducted on a sale |
| `EXPENSE` | Business expense recorded |

**Key design decisions:**
- Revenue is attributed to `entryDate` (payment date), not `saleDate` — correct cash-basis accounting
- Unique constraint on `(referenceId, referenceType, entryType)` prevents double-posting
- `LedgerService` is the single point of entry for all financial queries
- On-ledger backfill: `POST /accounting/backfill-ledger` populates ledger from existing Sale/Payment/Expense records (idempotent)

### Sales
- **Payment plans**: `FULL` (lump-sum) and `INSTALLMENT` (scheduled payments)
- Sale creation automatically posts to the general ledger
- Commission and tax rates are configurable per tenant; retroactive recalculation via `POST /accounting/recalculate-financials`
- Sale stats (`GET /sale/stats`) use ledger totals — consistent with accounting page

### Accounting Module (`/accounting`)
- `GET /accounting/summary?startDate=&endDate=` — period financial summary (revenue, commission, tax, expenses, net profit) + YTD totals
- `GET /accounting/profit-loss` — P&L statement
- `GET /accounting/trend` — monthly revenue/expense trend (last N months)
- `GET /accounting/expense-breakdown` — expenses by category/payment method
- `GET /accounting/revenue` — cash revenue detail
- `GET /accounting/balance-sheet` — assets, liabilities, equity
- `GET /accounting/cash-flow` — operating cash flow statement
- `GET /accounting/anomalies` — real-time anomaly detection
- `GET /accounting/insights` — AI-generated financial insights
- `GET /accounting/validate` — cross-check ledger vs source tables

### Admin Dashboard (`/dashboard/admin`)
- **KPI cards** — all-time totals: Total Revenue (₦), Total Realtors, Total Clients, Total Properties
- **Sales Overview chart** — period-selector (Daily/Weekly/Monthly/Yearly) with month/year pickers; chart bars use **ledger revenue by payment date** (cash-basis, not sale date)
- **Realtor tier distribution** donut chart
- **Control Panel** — quick-access grid to all 30+ modules
- **Monthly Highlights** — Staff/Realtor/Client of the Month + Top Property Sale

### Accounting Overview Page (`/dashboard/admin/accounting`)
- **Period selector**: This Month / Last Month / This Quarter / Last Quarter / This Year / All Time
- Stat cards update with fade animation (no full-page flash) when period changes
- YTD totals always shown alongside the selected period

### HR Module
- Attendance tracking with check-in/out
- Payroll with salary configuration (base, allowances, deductions)
- Realtor payroll (commission payouts)
- Leave management
- Performance reviews
- Task assignment

### Other Modules
- **CMS** — page content management
- **Newsletter** — email campaign management
- **Gallery** — media library
- **Channels** — broadcast announcements
- **Chat** — real-time messaging (Socket.IO)
- **Support** — client support tickets
- **Engagement** — social feed, posts
- **Audit Logs** — full activity history
- **Referral Tracking** — referral links and stats
- **Tax Reports** — tax records and exports

---

## Project Structure

```
rms-platform/
├── backend/                     # NestJS API
│   ├── prisma/
│   │   ├── schema.prisma        # Tenant schema
│   │   ├── master.prisma        # Master (companies) schema
│   │   └── tenant-schema.sql   # Raw SQL for new tenant provisioning
│   ├── scripts/
│   │   ├── backfill-prod.mjs   # One-time: backfill ledger for all tenants
│   │   ├── fix-double-count.mjs # One-time: remove FULL-plan duplicate entries
│   │   └── monthly-breakdown.mjs # Debug: ledger audit by month per tenant
│   └── src/
│       ├── modules/
│       │   ├── accounting/      # General ledger, P&L, cash flow, anomalies
│       │   ├── admin/           # Admin dashboard stats
│       │   ├── sale/            # Sales + payment plans
│       │   ├── hr/              # Payroll, attendance, leave
│       │   ├── tax/             # Tax engine
│       │   ├── settings/        # Tenant settings (commission %, tax %)
│       │   └── ...              # 20+ other modules
│       └── common/
│           ├── utils/
│           │   └── date-range.util.ts  # Period helpers + chart bucket builder
│           └── services/
│               └── ledger.service.ts   # Ledger read/write helpers
│
├── frontend/                    # Next.js tenant app
│   └── src/
│       ├── app/dashboard/
│       │   ├── admin/           # Admin pages (accounting, analytics, sales…)
│       │   ├── realtor/         # Realtor dashboard
│       │   ├── client/          # Client portal
│       │   ├── staff/           # Staff portal
│       │   └── hr/              # HR portal
│       ├── components/
│       │   └── icons/
│       │       └── naira-sign.tsx  # Custom ₦ icon (replaces DollarSign)
│       └── lib/
│           └── utils.ts         # formatCurrency (NGN/₦), formatDate, etc.
│
└── super-admin/                 # Standalone Super Admin Next.js app
    └── src/
        ├── app/dashboard/
        │   ├── page.tsx         # Overview — companies, revenue, users
        │   ├── companies/       # Tenant list, activate/deactivate
        │   ├── analytics/       # Cross-tenant analytics
        │   ├── notifications/   # Platform-wide notifications
        │   └── settings/        # Platform settings
        └── components/
            └── icons/
                └── naira-sign.tsx
```

---

## Deployment

All three apps deploy independently to Vercel.

```bash
# Deploy backend
cd backend
npx vercel --prod

# Deploy frontend (from root)
cd ..
npx vercel --prod

# Deploy super-admin
cd super-admin
npx vercel --prod
```

### Environment Variables

**Backend** (`.env.production`):
```
MASTER_DATABASE_URL=       # Master Supabase DB (session mode, port 5432)
DATABASE_URL=              # Tenant default (for Prisma generate only)
DIRECT_URL=                # Same as DATABASE_URL
JWT_SECRET=
REDIS_URL=
MAIL_*=                    # SMTP config
```

**Frontend** (`.env.production` / Vercel env):
```
NEXT_PUBLIC_API_URL=       # Backend Vercel URL (e.g. https://xyz.vercel.app/api/v1)
```

---

## Key Decisions & Gotchas

| Topic | Decision |
|-------|----------|
| Cash-basis revenue | Always read from `general_ledger.entryDate`, never `sale.saleDate` |
| Chart revenue | `groupSalesIntoChartBuckets` uses ledger entries for revenue bars, sale records only for count bars |
| FULL plan double-count | FULL-plan initial payment must NOT create a `SALE_PAYMENT/PAYMENT` ledger entry (already covered by `SALE_PAYMENT/SALE`) — see `fix-double-count.mjs` |
| Supabase pooler | Use port **5432** (session mode) for DDL and migrations; port **6543** (transaction mode) for normal queries |
| Prisma generate on build | Build script exports placeholder DB URLs so `prisma generate` runs without a real DB connection |
| Currency | Nigerian Naira (₦/NGN) — `formatCurrency` uses `Intl.NumberFormat('en-NG', { currency: 'NGN' })` |
| DollarSign icon | Replaced globally with custom `NairaSign` SVG component (`components/icons/naira-sign.tsx`) |

---

## API Documentation

Swagger UI available at `/api/docs` on the running backend.

---

<div align="center">
  <p>© 2025 RMS Platform. All rights reserved.</p>
</div>

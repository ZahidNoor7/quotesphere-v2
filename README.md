# QuoteSphere

Professional invoicing, quotations, and business management built with Next.js 15, MongoDB, and NextAuth v5.

## Features

- **Dashboard** — Revenue charts, collection stats, top clients, overdue alerts
- **Invoices** — Full CRUD, payment ledger (record partial/full payments), outstanding tracking
- **Quotations** — Create, approve/reject, one-click convert to invoice with item selection
- **Clients** — Full profile with invoice/quotation/expense history and stats
- **Expenses** — Record bills against clients and projects
- **Projects** — Track work by status, budget, and due date
- **Services Catalog** — Predefined services for quick-add to invoices
- **Settings** — Company info, document defaults, currencies
- **Dark mode** — System-aware with manual toggle
- **Fully responsive** — Mobile-first with slide-in nav drawer

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Database | MongoDB + Mongoose |
| Auth | NextAuth v5 |
| Styling | Tailwind CSS v3 + shadcn/ui primitives |
| Charts | Recharts |
| Notifications | Sonner |
| Data fetching | SWR |
| Images | Cloudinary |

## Quick Start

```bash
# 1. Clone and install
git clone <repo>
cd quotesphere
npm install

# 2. Set up environment
cp .env.example .env.local
# Fill in MONGO_URI, NEXTAUTH_SECRET, NEXTAUTH_URL

# 3. Run in development
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and register your account.

## Environment Variables

See `.env.example` for all required variables.

**Minimum required to run:**
- `MONGO_URI` — MongoDB Atlas connection string
- `NEXTAUTH_SECRET` — Random 32-char string (`openssl rand -base64 32`)
- `NEXTAUTH_URL` — Your app URL

**Optional:**
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` — Enable Google sign-in
- `CLOUDINARY_*` — Enable image uploads on invoices

## Deployment (Vercel + MongoDB Atlas)

1. Push to GitHub
2. Import project on [vercel.com](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy — done ✓

Both Vercel Hobby and MongoDB Atlas M0 are free forever for this scale.

## Project Structure

```
quotesphere/
├── app/
│   ├── api/               # All API routes
│   │   ├── auth/          # NextAuth + register
│   │   ├── invoices/      # CRUD + payment ledger
│   │   ├── quotations/    # CRUD + convert endpoint
│   │   ├── customers/     # CRUD + detail with stats
│   │   ├── expenses/      # CRUD
│   │   ├── projects/      # CRUD
│   │   ├── services/      # CRUD
│   │   ├── settings/      # Get/upsert
│   │   └── dashboard/     # Aggregated stats
│   ├── auth/              # Login + register pages
│   ├── dashboard/         # Main dashboard
│   ├── invoices/          # List + detail + new
│   ├── quotations/        # List + detail + new
│   ├── customers/         # List + detail
│   ├── expenses/          # List + new
│   ├── projects/          # List
│   ├── services/          # Catalog
│   └── settings/          # Company settings
├── components/
│   ├── ui/                # Button, Input, Card, Dialog, Badge
│   ├── layout/            # Sidebar, AppShell, ThemeProvider
│   ├── forms/             # DocumentBuilder (invoice + quotation)
│   └── shared/            # StatusBadges, PageHeader, StatCard
├── models/                # Mongoose schemas
│   ├── Invoice.ts         # With payment ledger array
│   ├── Quotation.ts       # With conversion tracking
│   ├── Customer.ts
│   ├── Expense.ts
│   ├── Project.ts
│   ├── Service.ts
│   ├── Settings.ts
│   ├── User.ts
│   └── Counter.ts         # Auto-numbering (INV-00001 etc.)
├── lib/
│   ├── db.ts              # MongoDB native client (for NextAuth)
│   ├── mongoose.ts        # Mongoose connection
│   └── utils.ts           # formatCurrency, formatDate, cn...
├── types/
│   └── index.ts           # All TypeScript interfaces
└── auth.ts                # NextAuth v5 config
```

## Key Implementation Notes

### Payment Ledger
Invoices store a `payments[]` array. Each entry records date, amount, method, and reference. A Mongoose pre-save hook recalculates `total_paid`, `outstanding`, and `payment_status` automatically on every save.

### Quotation → Invoice Conversion
`POST /api/quotations/[id]/convert` accepts optional `selectedItemIds` for partial conversion. It creates a new invoice, marks the quotation as "invoiced", and stores a bidirectional link between both documents.

### Auto-numbering
The `Counter` model uses `findOneAndUpdate` with `$inc` and `upsert: true` for atomic sequential number generation (INV-00001, QT-00001, EXP-00001, PRJ-00001).
# quotesphere-v2

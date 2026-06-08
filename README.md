# PDC Payroll

A corporate financial and payroll management system for running payroll, tax, HR,
expenses, and finance operations in one visual, mobile-responsive app.

> Status: **front-end complete, on realistic mock data, with the Supabase database
> connected.** Every screen, chart, and drill-down is built and deploy-ready. The
> database has its schema + baseline RLS applied and is verified live (`/api/health`).
> The calculation engine and full data wiring come in the next phase against the
> documented data contracts.

Currency: **PKR**. Payroll cycle: **monthly**.

---

## Tech stack

| Layer        | Choice                                             |
| ------------ | -------------------------------------------------- |
| Framework    | Next.js 15 (App Router) + React 18 + TypeScript    |
| Styling      | Tailwind CSS v4 (CSS-first `@theme` tokens)        |
| Charts       | Recharts                                           |
| Icons        | lucide-react                                       |
| Backend (next phase) | Supabase (Postgres + Auth + RLS)           |
| Hosting      | Vercel                                             |

---

## What's built

- **Dashboard** — visual financial story: headline KPIs with trends, 12-month charts,
  department comparison, salary composition, recent activity. Every figure drills down.
- **Payroll main sheet** — dense per-employee table; tap any row for the full salary
  breakdown (basic, allowances, commission, overtime, tax, deductions, net).
- **Employees** — list, conditional add/edit form (commission fields for Sales,
  overtime for technical teams), rich profile with history.
- **Overtime / Increments / Deductions** — the salary-adjustment modules, month-aware,
  feeding the main sheet.
- **Tax** — salary with vs without tax, per-employee detail, department totals.
- **Expenses** — org-wide breakdown, recurring vs variable, department drill-down,
  12-month trend.
- **Task board** — interactive kanban; payroll tasks auto-scheduled monthly.
- **Reports** — period scopes (month / YTD / 12 months), multi-metric trends,
  department + monthly summaries.
- **Employee self-service payslip** — mobile-first, calm, trustworthy.
- **Login** — branded split-screen.
- **RBAC preview** — switch roles (Admin / HR / Department Head / Employee) in the top
  bar to see how the UI gates per role. The real enforcement is RLS (next phase).

All numbers come from a deterministic mock data layer (`src/lib/data`) so every screen
looks alive. See `docs/BACKEND_WIRING.md` for how to swap mock data for Supabase.

---

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Create your local env file (never commit it)
cp .env.example .env.local
# then fill in your Supabase values in .env.local

# 3. Run the dev server
npm run dev
# open http://localhost:3000  (redirects to /dashboard)
```

### Scripts

| Command           | Description                          |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Start the dev server                 |
| `npm run build`   | Production build                     |
| `npm run start`   | Run the production build             |
| `npm run typecheck` | Type-check without emitting        |

---

## Environment variables

All secrets live **only** in a local `.env.local` (gitignored) and in Vercel's
environment variables. Never commit them.

| Variable                        | Exposure     | Used for                                   |
| ------------------------------- | ------------ | ------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Browser-safe | Supabase project URL                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-safe | Public anon key (RLS-gated)                |
| `SUPABASE_SERVICE_ROLE_KEY`     | **Server only** | Privileged server operations (bypasses RLS) |
| `SUPABASE_DB_PASSWORD`          | **Server only** | CLI migrations                           |

The `NEXT_PUBLIC_` prefix means a value is inlined into the client bundle. The
`service_role` key has **no** prefix and is read only by `src/lib/supabase/admin.ts`,
which starts with `import "server-only"` — a build-time guard that makes the build fail
if it is ever imported into client code. This is how the key can never reach the browser.

> Security note: the keys originally shared in chat should be **rotated** in the Supabase
> dashboard (Settings → API to roll keys, Settings → Database to reset the password),
> because they were transmitted in plaintext.

---

## Database

The Supabase database (`znzzhdgunjyzrerkffss`, region `ap-southeast-1`) is **connected
and provisioned**:

- Schema, indexes, and baseline RLS are applied via `supabase/migrations/0001_initial_schema.sql`.
- The org structure (4 departments, 8 teams, sample employees) is seeded.
- RLS is enabled on every table. Org structure is readable by authenticated users;
  sensitive tables are service-role-only until per-role policies are added (logic phase).

Verify the live connection any time:

```bash
curl http://localhost:3000/api/health
# -> { "status": "ok", "database": "connected", "departments": 4 }
```

Re-apply or extend migrations (reads `.env.local`, routes via the IPv4 pooler):

```bash
npm run db:migrate
```

## Project structure

```
src/
  app/
    (app)/               # authenticated shell (sidebar + topbar)
      dashboard/  payroll/  employees/  overtime/
      increments/  deductions/  tax/  expenses/
      tasks/  reports/  my-payslip/
      layout.tsx         # AppStateProvider + AppShell
    login/               # standalone login (no shell)
    layout.tsx           # root layout (fonts, globals)
    globals.css          # design tokens (@theme) + base styles
  components/
    layout/              # sidebar, topbar, app-shell, nav, logo
    ui/                  # design-system primitives (card, table, sheet, ...)
    charts/              # Recharts wrappers (themed)
    payroll/  employees/ # feature components
    providers/           # app-state context (role + month)
  lib/
    data/                # mock data layer + selectors (the data contract)
    supabase/            # client (anon) + admin (server-only) scaffolding
    format.ts            # PKR / number / date formatting
    utils.ts             # cn() helper
```

---

## Brand swap (make it yours)

The whole UI is token-driven, so rebranding is a few edits:

1. **Colors** — edit the `--color-brand-*` and `--color-accent-*` scales at the top of
   `src/app/globals.css` (inside `@theme`). Every component re-skins automatically.
2. **Chart colors** — mirror the brand hex in `CHART` in `src/components/charts/index.tsx`
   (kept separate so SVG fills render reliably).
3. **Logo** — replace the placeholder mark in `src/components/layout/logo.tsx` with your
   SVG. The login panel mark is in `src/app/login/page.tsx`.

The theme is light-only by design. Tokens are structured so a dark theme can be added
later without touching components.

---

## Deploying to Vercel

See the step-by-step guide in **`docs/DEPLOYMENT.md`**.

## Wiring the backend (Supabase)

The front-end reads everything through typed selector functions in `src/lib/data`. Those
signatures are the contract your Supabase layer fulfils. See **`docs/BACKEND_WIRING.md`**.

---

## Known limitations (front-end phase)

- Forms (add employee, log overtime, increments, deductions, tasks) are UI-only; they do
  not persist yet. Saving is wired to Supabase in the logic phase.
- The tax figure uses a clearly-labelled placeholder slab model
  (`mockWithholdingTax` in `src/lib/data/engine.ts`). Replace with real FBR slabs.
- The role switcher previews UI gating only. Baseline RLS is enabled on every table;
  the granular per-role policies (dept_head scoping, employee self-only) come next phase.
- The app UI still reads the mock dataset. The database is connected and seeded, but
  swapping the selectors in `src/lib/data` to read from Supabase is the logic phase.

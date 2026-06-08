# Deploying to Vercel

The app is configured to deploy cleanly to Vercel as a standard Next.js project.
`npm run build` passes locally with zero type errors and all routes prerender.

---

## Prerequisites

- The repo pushed to GitHub: `https://github.com/juestimating/PDC-Payroll`
- A Vercel account with access to that repo
- Your Supabase keys (kept out of git, in `.env.local` locally)

---

## Step 1 — Push the code

```bash
git push origin main
```

> Note: the GitHub account `itisjerry` currently has **read-only** access to
> `juestimating/PDC-Payroll`. An org owner must grant it **Write** access
> (repo → Settings → Collaborators and teams) before the push will succeed.

## Step 2 — Import the project into Vercel

1. Vercel dashboard → **Add New… → Project**.
2. Import `juestimating/PDC-Payroll`.
3. Framework preset: **Next.js** (auto-detected). Build command `next build` and output
   are auto-configured. Leave defaults.

## Step 3 — Set environment variables

In the import screen (or Project → Settings → Environment Variables), add these for the
**Production** (and Preview) environments:

| Name                            | Value                          | Notes                         |
| ------------------------------- | ------------------------------ | ----------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | `https://<ref>.supabase.co`    | from Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon public key           | safe for the browser          |
| `SUPABASE_SERVICE_ROLE_KEY`     | your service_role key          | **do not** mark as public; server-only |
| `SUPABASE_DB_PASSWORD`          | your database password         | only needed if running migrations from CI |

> Important: only the two `NEXT_PUBLIC_` variables are exposed to the browser. Never give
> the `service_role` key a `NEXT_PUBLIC_` name. Vercel encrypts all of them at rest.

## Step 4 — Deploy

Click **Deploy**. Vercel installs, builds, and serves the app. Every push to `main`
triggers a production deploy; pull requests get preview deployments automatically.

## Step 4.5 — Verify the database connection

The database (`znzzhdgunjyzrerkffss`, region `ap-southeast-1`) is already provisioned:
schema, baseline RLS, and the org seed are applied (`supabase/migrations/0001_initial_schema.sql`).
After the deploy finishes, confirm the live connection:

```
curl https://<your-app>.vercel.app/api/health
# -> { "status": "ok", "database": "connected", "departments": 4 }
```

If it returns `disconnected`, the `SUPABASE_*` env vars are missing or wrong in Vercel.

## Step 5 — Custom domain (optional)

Project → Settings → Domains → add your domain and follow the DNS instructions.

---

## Rollback

Vercel keeps every deployment. To roll back: Project → Deployments → pick a previous
healthy deployment → **Promote to Production**. No rebuild needed.

## Troubleshooting

- **Build fails on env vars:** the front-end runs on mock data and does not require the
  Supabase vars to build. If you add server code that reads them at build time, make sure
  the variables are set for the right environment.
- **Wrong workspace root warning:** handled via `outputFileTracingRoot` in
  `next.config.ts`.
- **Fonts:** Inter is fetched at build time by `next/font` and self-hosted by Vercel; no
  runtime network dependency.

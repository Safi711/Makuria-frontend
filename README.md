# Makuria Frontend — Phase 0.6 Foundation

Owned Makuria frontend codebase (Next.js 16, App Router, TypeScript, Tailwind),
built in parallel with the existing makuria.pplx.app. **Not connected to
production DNS.** Same Supabase project as production
(`damzdxcutawghksuzoan`) — read-only public data via the anon key, no schema
changes, no new auth system.

See the Phase 0.6 report (in the Makuria Case Mapper v1 Claude project) for
the full A–J deliverable. This file only covers running/deploying this code.

## What's here

- Public research: `/`, `/laws`, `/laws/[slug]`, `/cases`, `/cases/[slug]`,
  `/principles`, `/principles/[slug]`, `/search` — real data from Supabase,
  paginated and field-selected (no `select('*')` on large tables).
- Auth: `/login`, `/signup` using Supabase Auth (same config as production).
- Lawyer Workspace shell: `/workspace` (protected) plus reserved route space
  for `/matters`, `/case-mapper`, `/quick-check`, `/practical-law`, `/alerts`
  — each an honest "coming soon" empty state, no fabricated functionality.
- `proxy.ts` (Next.js 16's renamed `middleware.ts`) gates the workspace
  routes and refreshes the Supabase session cookie on every request.

## Running it locally

```bash
npm install
cp .env.local.example .env.local   # already has the real anon key — see below
npm run dev
```

The anon key in `.env.local.example` is the same public anon key already
used by production makuria.pplx.app's own client-side calls — it is safe by
design (every table it can reach is governed by existing RLS). Never put a
`service_role` key in this project.

## Deploying a preview to Vercel

**This could not be completed from the cloud session that built this
codebase** — that sandbox's outbound network is restricted to a small
allowlist (npm registry, GitHub) and does not reach `vercel.com`, and no
Vercel or GitHub credentials for this account were available there either.
Two ways to finish it from a machine that isn't sandboxed like that:

### Option A — Vercel CLI (fastest if you have Node.js locally)

```bash
npm install -g vercel
cd makuria-frontend
vercel login          # one-time, opens a browser link
vercel                # links the project, deploys a PREVIEW (not --prod)
```
When prompted for environment variables, or afterwards in the Vercel
dashboard's Project Settings → Environment Variables, set:
- `NEXT_PUBLIC_SUPABASE_URL` = `https://damzdxcutawghksuzoan.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (copy from `.env.local.example`)
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` = optional, leave unset for now

Running plain `vercel` (no `--prod`) always deploys to a preview URL —
it will not touch makuria.legal or makuria.pplx.app.

### Option B — GitHub + Vercel dashboard (no CLI needed)

1. Push this folder to a new **private** GitHub repo you own.
2. On vercel.com: **Add New → Project → Import** that repo.
3. Add the same three environment variables as above.
4. Deploy. Vercel gives you a `*.vercel.app` preview URL automatically —
   again, nothing is connected to the real domain unless you add it
   yourself under Project Settings → Domains (do not do this yet).

## Manual validation checklist (do this on the real preview URL before requesting cutover)

- [ ] `/` loads, shows a laws teaser with verified/unverified badges
- [ ] `/laws` lists laws, category filter works, pagination works past page 1
- [ ] `/laws/[slug]` shows a real law with paginated articles
- [ ] `/cases` and `/cases/[slug]` show real precedents
- [ ] `/principles` shows only published principles (compare count against
      the `legal_principles` table's published rows)
- [ ] `/search?q=...` returns real results via `quick_search`
- [ ] `/workspace` redirects to `/login` when signed out
- [ ] `/signup` creates a real Supabase Auth user; `/login` then succeeds
- [ ] After logging in, `/workspace` shows the signed-in email and a real
      matters count (0 for a fresh account)
- [ ] `/matters`, `/case-mapper`, `/quick-check`, `/practical-law`, `/alerts`
      each show the honest "coming soon" state, not an error
- [ ] Language toggle in the header switches Arabic ⇄ English and flips
      RTL/LTR correctly
- [ ] Confirm in the Network tab that list pages request limited fields and
      a bounded row range — not `select=*` on the full table
- [ ] Lighthouse/PageSpeed pass on `/laws` and compare page-weight and load
      time against the same page on makuria.pplx.app (Section F of the
      Phase 0.6 report)

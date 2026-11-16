# CYBERX OS

**One Account. One Dashboard. Complete Digital Ecosystem.**

A modular Next.js control center for your own projects and authorized services.

## Included in this repository

- Responsive mobile-first dashboard
- Supabase email/password sign-in, registration and PKCE callback
- Cookie-based server-side session refresh for Next.js 15
- User profiles, role and credits foundation
- Project records with per-user ownership and CRUD API
- Admin user list, role/credit editor and audit events
- Database foundations for bots, API catalog, lawful public-data tools, storage metadata, Firebase projects, community, streaming, plans, purchases and integrations
- Row Level Security enabled on all ecosystem tables
- Health endpoint at `/api/health`

## Important capability boundary

This repository provides the account, dashboard, project-management and database foundations. Provider actions are not magically connected by adding a token: bot execution needs a separate worker/runtime, API proxying needs gateway infrastructure, storage needs a bucket and server-side adapter, video needs an authorized delivery path, and GitHub/Firebase/hosting actions need OAuth or service credentials. Those adapters must be configured and tested individually. Do not treat placeholder module screens or database records as live deployments.

OSINT tools are restricted to lawful public sources and systems the account owner is authorized to access. Never use this platform to collect private data or access systems without permission.

## Requirements

- Node.js 20+
- A Supabase project
- A Vercel or Node.js-compatible deployment

## Environment variables

Copy `.env.example` values into your deployment environment. Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; needed for admin user management)

Never put the service-role key or provider secrets in browser code or commit them to GitHub.

## Database setup

Run the SQL files in order in Supabase SQL Editor:
1. `supabase/migrations/0001_cyberx_foundation.sql`
2. `supabase/migrations/0002_profile_permissions.sql`
3. `supabase/migrations/0003_ecosystem_modules.sql`

After creating your first account, use the Supabase SQL Editor to promote that account to admin. Replace the email with your own account email:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'YOUR_EMAIL_HERE');
```

The admin API checks the signed-in user's database role before using the server-only service-role client. Admin changes to role and credits are recorded in the audit and credit ledger tables.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
``

Open `http://localhost:3000`.

## Deploy

Import this repository into Vercel, set the environment variables above, deploy, then add your production URL to Supabase Auth URL Configuration. Add the callback URL:
`https://YOUR_DOMAIN/auth/callback`

For local development also allow:
`http://localhost:3000/auth/callback`

## Service architecture

- Next.js: dashboard, auth and control APIs
- Supabase: Auth, Postgres and RLS
- Separate worker: long-running bot processes and scheduled jobs
- Cloudflare R2 or another object store: user files and media
- Provider OAuth/API adapters: GitHub, Firebase and hosting services

## Health check

`GET /api/health` returns service status and whether public Supabase configuration is present.

## Security

- Row Level Security on exposed tables
- Owner-scoped project and integration records
- Role and credit updates are server-only
- Never trust user-editable metadata for authorization
- Provider secrets must be encrypted at rest and never returned to browser clients
- Audit privileged operations
- Only connect assets, projects and accounts you are authorized to manage

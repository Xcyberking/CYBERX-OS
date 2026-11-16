# CYBERX OS

**One Account. One Dashboard. Complete Digital Ecosystem.**

A modular Next.js control center for your own projects and authorized services.

## Included

- Responsive mobile-first dashboard
- Supabase email/password signup and login
- Email confirmation callback and password reset
- Cookie-based server-side auth refresh for Next.js 15
- User profiles, server-managed roles and credits
- Per-user project create/list/delete API
- Admin account list, role and credit editor
- Atomic admin credit adjustments with ledger and audit records
- In-app notification inbox and admin notification delivery
- Community groups, membership controls and member-only group chat
- Database foundations for bots, API catalog, lawful public-data tools, storage metadata, Firebase projects, community, streaming, plans, purchases and integrations
- Row Level Security enabled on ecosystem tables
- Health endpoint at `/api/health`

## What still requires provider setup

The dashboard and account/project management are implemented. A database schema is not the same as a live third-party integration. Actual bot execution requires a separate worker/runtime; API forwarding requires gateway infrastructure; file and video operations require storage buckets and delivery adapters; GitHub, Firebase, Render, Railway and Cloudflare actions require provider OAuth/API credentials. Those adapters must be connected and tested separately. Do not assume a provider is connected merely because a project record exists.

Use OSINT features only for lawful public sources and systems you are authorized to access.

## Requirements

- Node.js 22+
- A Supabase project
- Vercel or another Node.js-compatible host

## Environment

Copy `.env.example` values into your deployment environment. Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY` (server only; needed by admin operations)

Never put service-role keys or provider secrets in browser code or commit them to GitHub.

## Database setup

Run every SQL migration in order in Supabase SQL Editor:

1. `supabase/migrations/0001_cyberx_foundation.sql`
2. `supabase/migrations/0002_profile_permissions.sql`
3. `supabase/migrations/0003_ecosystem_modules.sql`
4. `supabase/migrations/0004_tighten_privileged_data.sql`
5. `supabase/migrations/0005_private_cloud_storage.sql`
6. `supabase/migrations/0006_wallet_and_community.sql`
7. `supabase/migrations/0007_admin_credits_and_notifications.sql`
8. `supabase/migrations/0008_community_groups_and_chat.sql`

Create your first account, then promote that account in SQL Editor (replace the email):

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'YOUR_EMAIL_HERE');
```

The admin API checks the signed-in user's profile role before using the service-role client. Credit changes use an atomic database function and are recorded in the credit ledger and audit log. Apply migrations 0005, 0006 and 0007 too; the complete migration order is 0001 through 0007.

API Studio execution is opt-in. Set `CYBERX_API_ALLOWED_HOSTS` to comma-separated trusted provider domains (for example `api.example.com`). Requests to unlisted hosts and redirects are blocked; calls time out after 15 seconds and responses are capped at 256 KB. Only add APIs and data sources you own or are authorized to use.\n\n## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Deploy

Import this repository into Vercel, set the environment variables, and deploy. In Supabase Auth URL Configuration add your production site URL and callback:
`https://YOUR_DOMAIN/auth/callback`

For local development allow:
`http://localhost:3000/auth/callback`

## Architecture

- Next.js: dashboard, authentication and control APIs
- Supabase: Auth, Postgres and RLS
- Separate worker: long-running bot processes and scheduled jobs
- Cloudflare R2 or another object store: user files and media
- Provider OAuth/API adapters: GitHub, Firebase and hosting services

## Security

- RLS on exposed tables
- Owner-scoped records
- Server-only role and credit updates
- No authorization decisions based on user-editable metadata
- Provider secrets stay server-side and should be encrypted at rest
- Audit privileged operations
- Only manage assets and projects you are authorized to access

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
- Developer Hub provider directory for GitHub, Vercel, Railway, Render, Cloudflare, Supabase, Firebase and Hugging Face
- Per-user provider setup records with RLS and encrypted GitHub OAuth token storage
- Community groups, membership controls and member-only group chat
- Database foundations for bots, API catalog, lawful public-data tools, storage metadata, Firebase projects, community, streaming, plans, purchases and integrations
- Row Level Security enabled on ecosystem tables
- Health endpoint at `/api/health`

## What still requires provider setup

The dashboard and account/project management are implemented. A database schema is not the same as a live third-party integration. Actual bot execution requires a separate worker/runtime; API forwarding requires gateway infrastructure; file and video operations require storage buckets and delivery adapters; GitHub, Firebase, Render, Railway, Vercel, Cloudflare, Supabase and Hugging Face actions require provider OAuth/API credentials. The Developer Hub includes a GitHub OAuth connection with encrypted server-side token storage and a read-only public repository browser, plus Vercel, Render, Cloudflare and Supabase token connections with encrypted server-side storage and read-only project/service/bucket inventory. Firebase currently remains a setup record and checklist. Hugging Face now supports an encrypted read-only connection that verifies the account and lists public models, datasets and Spaces; private repository browsing and write actions are not enabled. Do not assume a provider is connected merely because a project record exists.

Use OSINT features only for lawful public sources and systems you are authorized to access.

## Requirements

- Node.js 22+
- A Supabase project
- Vercel or another Node.js-compatible host

## Environment

Copy `.env.example` values into your deployment environment. Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY` (server only; needed by admin operations and encrypted integration storage)
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_REDIRECT_URI` (GitHub OAuth App)
- `INTEGRATION_ENCRYPTION_KEY` (32-byte hex key; generate with `openssl rand -hex 32`)

Never put service-role keys or provider secrets in browser code or commit them to GitHub.

## GitHub OAuth setup

Create a GitHub OAuth App and set its Authorization callback URL to `https://YOUR_DOMAIN/api/integrations/github/callback`. Add the four GitHub/encryption environment variables listed above to your host. The callback URL must exactly match `GITHUB_REDIRECT_URI`. Apply the existing database migrations first; `integration_connections.secret_ciphertext` already exists. The current GitHub scope is `read:user` only and the repository browser is read-only for public repositories. Private repository access and write operations are intentionally not enabled.

For Vercel, create a scoped access token with read access to the projects you want to view. Expand the Vercel card in Developer Hub and paste the token into the secure connection form. CYBERX verifies the token, encrypts it using `INTEGRATION_ENCRYPTION_KEY`, and shows project and recent deployment status only. It does not deploy, delete projects, or read environment variables.\n\nFor Render, create an API key from your Render account settings and paste it into the Render card in Developer Hub. Render API keys can access the workspaces available to that account. CYBERX verifies and encrypts the key server-side, then displays up to 50 services and the latest three deploy records per service. This adapter is read-only: it does not create, deploy, restart, suspend services, or read environment variables.\n\nFor Cloudflare, create a scoped API token with **Workers R2 Storage Read** permission for the account you own. Copy your 32-character Account ID from the Cloudflare dashboard, then connect both in the Cloudflare card in Developer Hub. The token is encrypted server-side and CYBERX lists R2 bucket metadata only. It does not upload, download, create or delete buckets/objects, change DNS, or modify Workers.\n\nFor Supabase, create a **scoped Personal Access Token** with Projects read permission and restrict it to the organizations/projects you own. Connect it in the Supabase card in Developer Hub. CYBERX encrypts the token server-side and lists project IDs, names, regions, status and available database version metadata. It does not run SQL, change schemas, create/pause projects, access billing, or retrieve database secrets. No new environment variables or database migrations are required beyond the existing Supabase service-role and integration encryption settings.

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

API Studio execution is opt-in. Set `CYBERX_API_ALLOWED_HOSTS` to comma-separated trusted provider domains (for example `api.example.com`). Requests to unlisted hosts and redirects are blocked; calls time out after 15 seconds and responses are capped at 256 KB. Only add APIs and data sources you own or are authorized to use.

## Local development

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


## Railway Developer Hub integration

Create an account API token in Railway account settings, then expand the Railway card in Developer Hub and connect it. Account tokens can access all resources and workspaces available to that Railway account, so use only your own account and protect the token. CYBERX verifies the token with Railway's `me` query, encrypts it server-side with `INTEGRATION_ENCRYPTION_KEY`, and reads project, service and environment names. The adapter is read-only: it does not deploy, restart services, read variables, create projects or delete resources. Workspace and project tokens are not supported by this account-token form. No new environment variables or database migrations are required beyond the existing Supabase service-role and integration encryption settings.


## Hugging Face Developer Hub integration

Create a fine-grained Hugging Face user access token with read-only permissions and connect it in the Hugging Face card in Developer Hub. CYBERX verifies the account using the official Hub identity endpoint, encrypts the token server-side with `INTEGRATION_ENCRYPTION_KEY`, and displays the account's public models, datasets and Spaces. This adapter does not upload files, create/delete repositories, run inference jobs or change account settings. Private repository inventory and write operations are intentionally not enabled. No new environment variables or database migrations are required beyond the existing Supabase service-role and integration-encryption settings.

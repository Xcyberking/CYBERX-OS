# CYBERX OS

**One Account. One Dashboard. Complete Digital Ecosystem.**

CYBERX OS is a modular control center intended to bring bot hosting, API management, lawful public-data tools, cloud storage, Firebase projects, community, streaming, and developer integrations into one secure workspace.

## Current foundation

- Responsive dark dashboard and module navigation
- Next.js 15 + React 19 + TypeScript
- Health endpoint at `/api/health`
- Supabase foundation migration with profile, project and usage tables
- Row Level Security policies for user-owned records
- Environment template for future integrations

> This is the initial foundation, not a claim that every integration is already operational. Modules are being implemented incrementally.

## Modules roadmap

1. Authentication, profiles, roles and admin controls
2. Bot hosting integrations (Railway / Render / VPS)
3. API Studio and API gateway
4. Lawful OSINT/public-data tool catalog
5. Cloud storage and verified backups
6. Firebase project manager
7. Community and moderation
8. Video streaming
9. GitHub and deployment hub
10. Wallet, credits, plans and audit logs

## Local development

Requirements: Node.js 20+ and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

## Environment

See `.env.example`. Supabase is optional for the current dashboard shell, but required for authentication and persisted user data in the next phase.

Never commit real credentials. Never expose `SUPABASE_SERVICE_ROLE_KEY`, provider secrets, deployment tokens or private API keys in browser code.

## Database setup

Review and apply `supabase/migrations/0001_cyberx_foundation.sql` to your Supabase project. The migration enables RLS. Admin role and credit changes must be performed by trusted server-side code; do not allow users to set their own role or credits.

## Health check

`GET /api/health` returns application status and whether the public Supabase configuration is present.

## Deployment

Deploy the Next.js app to Vercel or another Node.js-compatible host. Add environment variables in the host dashboard. Background bot workloads and long-running jobs should run as separate services (for example, Railway/Render/VPS), not inside short-lived web requests.

## Security principles

- Least-privilege OAuth scopes
- Per-user ownership checks and RLS
- Server-side secret storage
- Audit events for privileged actions
- Rate limits and request validation
- Backups with restore testing
- Only manage projects and data the account owner is authorized to access

## License

All rights reserved unless a license is added by the repository owner.

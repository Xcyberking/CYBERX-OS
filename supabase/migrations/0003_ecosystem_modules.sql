-- CYBERX OS ecosystem data foundation.
-- Run after 0001 and 0002. Provider secrets are intentionally NOT stored in JSON config.
drop function if exists public.is_admin();

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  admin_id uuid references auth.users(id) on delete set null,
  amount integer not null,
  balance_after integer not null check (balance_after >= 0),
  reason text not null default 'Credit adjustment',
  created_at timestamptz not null default now()
);

create table if not exists public.api_endpoints (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  endpoint_url text not null,
  method text not null default 'GET' check (method in ('GET','POST','PUT','PATCH','DELETE')),
  description text not null default '',
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tool_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  category text not null default 'general',
  endpoint_url text not null,
  method text not null default 'GET' check (method in ('GET','POST','PUT','PATCH','DELETE')),
  credit_cost integer not null default 1 check (credit_cost >= 0),
  is_active boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  label text not null,
  status text not null default 'pending' check (status in ('pending','connected','error','disconnected')),
  account_label text,
  public_config jsonb not null default '{}'::jsonb,
  secret_ciphertext text,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, provider, label)
);

create table if not exists public.bot_instances (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  name text not null,
  runtime text not null default 'python' check (runtime in ('python','node')),
  provider text,
  external_service_id text,
  status text not null default 'draft' check (status in ('draft','queued','running','stopped','failed')),
  entrypoint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.firebase_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  project_id text not null,
  app_id text,
  database_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.storage_objects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  bucket_name text not null,
  object_key text not null,
  file_name text not null,
  content_type text,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  created_at timestamptz not null default now(),
  unique(owner_id, provider, bucket_name, object_key)
);

create table if not exists public.video_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  category text not null default 'General',
  storage_provider text,
  storage_key text,
  visibility text not null default 'private' check (visibility in ('private','unlisted','public')),
  created_at timestamptz not null default now()
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  visibility text not null default 'public' check (visibility in ('public','private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price_minor integer not null default 0 check (price_minor >= 0),
  currency text not null default 'INR',
  credits integer not null default 0 check (credits >= 0),
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete set null,
  amount_minor integer not null default 0 check (amount_minor >= 0),
  currency text not null default 'INR',
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
  provider_reference text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Every exposed table has RLS enabled.
alter table public.credit_transactions enable row level security;
alter table public.api_endpoints enable row level security;
alter table public.tool_catalog enable row level security;
alter table public.integration_connections enable row level security;
alter table public.bot_instances enable row level security;
alter table public.firebase_projects enable row level security;
alter table public.storage_objects enable row level security;
alter table public.video_assets enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.notifications enable row level security;
alter table public.plans enable row level security;
alter table public.purchases enable row level security;
alter table public.audit_logs enable row level security;

create policy "credit_transactions_read_own" on public.credit_transactions
 for select to authenticated using ((select auth.uid()) = user_id);
create policy "api_endpoints_owner_all" on public.api_endpoints
 for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "tool_catalog_read_active" on public.tool_catalog
 for select to authenticated using (is_active);
create policy "integration_connections_owner_all" on public.integration_connections
 for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "bot_instances_owner_all" on public.bot_instances
 for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "firebase_projects_owner_all" on public.firebase_projects
 for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "storage_objects_owner_all" on public.storage_objects
 for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "video_assets_owner_all" on public.video_assets
 for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "community_posts_read_public_or_own" on public.community_posts
 for select to authenticated using (visibility = 'public' or (select auth.uid()) = author_id);
create policy "community_posts_owner_insert" on public.community_posts
 for insert to authenticated with check ((select auth.uid()) = author_id);
create policy "community_posts_owner_update" on public.community_posts
 for update to authenticated using ((select auth.uid()) = author_id) with check ((select auth.uid()) = author_id);
create policy "community_posts_owner_delete" on public.community_posts
 for delete to authenticated using ((select auth.uid()) = author_id);
create policy "community_comments_read_public_posts" on public.community_comments
 for select to authenticated using (exists (select 1 from public.community_posts p where p.id = post_id and (p.visibility = 'public' or p.author_id = (select auth.uid()))));
create policy "community_comments_owner_insert" on public.community_comments
 for insert to authenticated with check ((select auth.uid()) = author_id);
create policy "community_comments_owner_delete" on public.community_comments
 for delete to authenticated using ((select auth.uid()) = author_id);
create policy "notifications_read_own" on public.notifications
 for select to authenticated using ((select auth.uid()) = user_id);
create policy "notifications_update_own" on public.notifications
 for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "plans_read_active" on public.plans
 for select to authenticated using (is_active);
create policy "purchases_read_own" on public.purchases
 for select to authenticated using ((select auth.uid()) = user_id);
create policy "audit_logs_read_actor" on public.audit_logs
 for select to authenticated using ((select auth.uid()) = actor_id);

-- Server-side code uses the service-role key for privileged writes. Do not expose it.
grant select, insert, update, delete on public.api_endpoints, public.integration_connections,
 public.bot_instances, public.firebase_projects, public.storage_objects, public.video_assets,
 public.community_posts, public.community_comments, public.notifications to authenticated;
grant select on public.credit_transactions, public.tool_catalog, public.plans, public.purchases, public.audit_logs to authenticated;

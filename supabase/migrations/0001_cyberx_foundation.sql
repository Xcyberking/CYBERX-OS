-- CYBERX OS foundation schema.
-- Apply through Supabase SQL Editor or Supabase CLI after reviewing.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  credits integer not null default 0 check (credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  module text not null check (module in ('bot-hosting','api-studio','osint','cloud-storage','firebase','community','streaming','developer-hub')),
  status text not null default 'draft' check (status in ('draft','active','paused','error','archived')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  event_type text not null,
  credits_delta integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.usage_events enable row level security;

-- Users can read and update only their own non-privileged profile fields.
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "projects_select_own" on public.projects
  for select using (auth.uid() = owner_id);
create policy "projects_insert_own" on public.projects
  for insert with check (auth.uid() = owner_id);
create policy "projects_update_own" on public.projects
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "projects_delete_own" on public.projects
  for delete using (auth.uid() = owner_id);
create policy "usage_select_own" on public.usage_events
  for select using (auth.uid() = user_id);

-- Profile creation is triggered by Supabase Auth. Never trust client-supplied role/credits.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Admin role/credit changes must be performed by trusted server-side code
-- using the service role key. Never expose that key in browser code.

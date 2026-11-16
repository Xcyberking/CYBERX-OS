-- Community groups and member-only group chat.
create table if not exists public.community_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 3 and 60),
  description text not null default '' check (char_length(description) <= 500),
  created_at timestamptz not null default now()
);
create table if not exists public.community_group_members (
  group_id uuid not null references public.community_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id,user_id)
);
create table if not exists public.community_group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.community_groups(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1500),
  created_at timestamptz not null default now()
);
create index if not exists community_groups_created_idx on public.community_groups(created_at desc);
create index if not exists community_group_messages_feed_idx on public.community_group_messages(group_id,created_at desc);
alter table public.community_groups enable row level security;
alter table public.community_group_members enable row level security;
alter table public.community_group_messages enable row level security;

drop policy if exists community_groups_read_signed_in on public.community_groups;
create policy community_groups_read_signed_in on public.community_groups
 for select to authenticated using (true);
drop policy if exists community_groups_owner_insert on public.community_groups;
create policy community_groups_owner_insert on public.community_groups
 for insert to authenticated with check ((select auth.uid()) = owner_id);
drop policy if exists community_groups_owner_delete on public.community_groups;
create policy community_groups_owner_delete on public.community_groups
 for delete to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists community_group_members_read_own on public.community_group_members;
create policy community_group_members_read_own on public.community_group_members
 for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists community_group_members_join_own on public.community_group_members;
create policy community_group_members_join_own on public.community_group_members
 for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists community_group_members_leave_own on public.community_group_members;
create policy community_group_members_leave_own on public.community_group_members
 for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists community_group_messages_read_members on public.community_group_messages;
create policy community_group_messages_read_members on public.community_group_messages
 for select to authenticated using (
   exists (select 1 from public.community_group_members m where m.group_id = group_id and m.user_id = (select auth.uid()))
 );
drop policy if exists community_group_messages_insert_members on public.community_group_messages;
create policy community_group_messages_insert_members on public.community_group_messages
 for insert to authenticated with check (
   (select auth.uid()) = author_id and
   exists (select 1 from public.community_group_members m where m.group_id = group_id and m.user_id = (select auth.uid()))
 );
grant select,insert,delete on public.community_groups, public.community_group_members to authenticated;
grant select,insert on public.community_group_messages to authenticated;

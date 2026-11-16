-- Tighten profile permissions: a signed-in user may edit only their own
-- display name and avatar. Role and credits are server-managed fields.
revoke update on table public.profiles from anon, authenticated;
grant update (display_name, avatar_url) on table public.profiles to authenticated;

-- Keep profile reads private to the account owner by default.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);

-- Ensure users cannot create or alter profile rows directly.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Admin authorization is based on a server-controlled role in profiles.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

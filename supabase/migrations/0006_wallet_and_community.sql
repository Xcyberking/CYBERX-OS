-- CYBERX OS wallet ledger and community reactions.
-- Apply after migration 0005.
create table if not exists public.community_likes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id,user_id)
);
alter table public.community_likes enable row level security;
drop policy if exists community_likes_read_signed_in on public.community_likes;
drop policy if exists community_likes_insert_own on public.community_likes;
drop policy if exists community_likes_delete_own on public.community_likes;
create policy community_likes_read_signed_in on public.community_likes
 for select to authenticated using (true);
create policy community_likes_insert_own on public.community_likes
 for insert to authenticated with check ((select auth.uid()) = user_id);
create policy community_likes_delete_own on public.community_likes
 for delete to authenticated using ((select auth.uid()) = user_id);
grant select,insert,delete on public.community_likes to authenticated;

-- Atomic debit: callers cannot choose a user id; only the authenticated account is debited.
create or replace function public.spend_credits(p_amount integer, p_reason text default 'Usage')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_balance integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_amount is null or p_amount < 1 or p_amount > 10000 then raise exception 'Invalid credit amount'; end if;
  update public.profiles
     set credits = credits - p_amount, updated_at = now()
   where id = v_user and credits >= p_amount
   returning credits into v_balance;
  if v_balance is null then raise exception 'Insufficient credits'; end if;
  insert into public.credit_transactions(user_id,amount,balance_after,reason)
  values(v_user,-p_amount,v_balance,left(coalesce(p_reason,'Usage'),160));
  return v_balance;
end;
$$;
revoke all on function public.spend_credits(integer,text) from public;
grant execute on function public.spend_credits(integer,text) to authenticated;

create or replace function public.get_wallet_summary()
returns table(balance integer, transactions_count bigint)
language sql
security invoker
set search_path = ''
as $$
  select p.credits, count(t.id)
  from public.profiles p
  left join public.credit_transactions t on t.user_id=p.id
  where p.id=auth.uid()
  group by p.credits;
$$;
grant execute on function public.get_wallet_summary() to authenticated;

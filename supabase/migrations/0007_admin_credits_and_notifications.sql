-- Atomic admin credit adjustments. Only the trusted server service-role client may call this RPC.
create or replace function public.admin_set_user_credits(
  p_actor_id uuid,
  p_user_id uuid,
  p_new_balance integer,
  p_reason text default 'Admin adjustment'
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old integer;
  v_delta integer;
begin
  if p_actor_id is null or p_user_id is null then raise exception 'Actor and target are required'; end if;
  if p_new_balance is null or p_new_balance < 0 or p_new_balance > 1000000 then raise exception 'Invalid credit balance'; end if;
  if not exists (select 1 from public.profiles where id = p_actor_id and role = 'admin') then
    raise exception 'Admin access required';
  end if;
  select credits into v_old from public.profiles where id = p_user_id for update;
  if v_old is null then raise exception 'User profile not found'; end if;
  v_delta := p_new_balance - v_old;
  update public.profiles set credits = p_new_balance, updated_at = now() where id = p_user_id;
  if v_delta <> 0 then
    insert into public.credit_transactions(user_id, admin_id, amount, balance_after, reason)
    values (p_user_id, p_actor_id, v_delta, p_new_balance, left(coalesce(p_reason, 'Admin adjustment'), 160));
  end if;
  insert into public.audit_logs(actor_id, action, target_id, details)
  values (p_actor_id, 'admin.credits.updated', p_user_id,
    jsonb_build_object('previous_credits', v_old, 'credits', p_new_balance, 'reason', left(coalesce(p_reason, 'Admin adjustment'),160)));
  return p_new_balance;
end;
$$;
revoke all on function public.admin_set_user_credits(uuid,uuid,integer,text) from public, anon, authenticated;
grant execute on function public.admin_set_user_credits(uuid,uuid,integer,text) to service_role;

-- Notifications are inserted by trusted server-side events/admin actions.
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications(user_id) where read_at is null;

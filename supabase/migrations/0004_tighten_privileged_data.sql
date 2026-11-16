-- Tighten client privileges for records that must be written by trusted adapters.
-- Apply after 0003. RLS remains enabled as defense in depth.

-- Integration credentials and their connection state are server-managed.
drop policy if exists "integration_connections_owner_all" on public.integration_connections;
create policy "integration_connections_read_own" on public.integration_connections
  for select to authenticated using ((select auth.uid()) = owner_id);
revoke all on public.integration_connections from anon, authenticated;
grant select on public.integration_connections to authenticated;

-- Storage inventory is written by the verified storage adapter, not by clients.
revoke insert, update, delete on public.storage_objects from anon, authenticated;
grant select on public.storage_objects to authenticated;

-- Bot status must reflect a real worker callback. Users may register/delete their
-- own bot records, but cannot spoof running/stopped state from the browser.
revoke update on public.bot_instances from anon, authenticated;
grant select, insert, delete on public.bot_instances to authenticated;

-- Purchases, credit ledger, audit trail, tool catalog, plans and connection
-- secrets are only mutated by trusted server-side services.
revoke insert, update, delete on public.credit_transactions, public.tool_catalog,
  public.plans, public.purchases, public.audit_logs from anon, authenticated;
grant select on public.credit_transactions, public.tool_catalog,
  public.plans, public.purchases, public.audit_logs to authenticated;

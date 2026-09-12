begin;

-- Qualify user_id references in the Global Admin read and scope functions.
-- The functions return a user_id column, which otherwise conflicts with
-- same-named table columns under PL/pgSQL name resolution.
create or replace function public.global_admin_list_users(
  p_search text default null,
  p_status text default 'all',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  email text,
  created_at timestamptz,
  last_active_at timestamptz,
  account_status text,
  data_version text,
  checkin_count bigint,
  diary_count bigint,
  custom_count bigint,
  override_count bigint
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin role required';
  end if;

  return query
  select
    account.id,
    coalesce(account.email, ''),
    account.created_at,
    account.last_sign_in_at,
    case when account.last_sign_in_at >= now() - interval '30 days' then 'active' else 'inactive' end,
    'v2.1'::text,
    (select count(*) from public.checkins checkin_row where checkin_row.user_id = account.id),
    (select count(*) from public.diary_entries diary_row where diary_row.user_id = account.id and diary_row.status <> 'deleted'),
    0::bigint,
    0::bigint
  from auth.users account
  where (
      nullif(btrim(coalesce(p_search, '')), '') is null
      or account.email ilike '%' || btrim(p_search) || '%'
      or account.id::text ilike '%' || btrim(p_search) || '%'
    )
    and (
      coalesce(p_status, 'all') = 'all'
      or (p_status = 'active' and account.last_sign_in_at >= now() - interval '30 days')
      or (p_status = 'inactive' and (account.last_sign_in_at is null or account.last_sign_in_at < now() - interval '30 days'))
    )
  order by account.last_sign_in_at desc nulls last, account.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 100))
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.global_admin_resolve_scope(p_scope jsonb)
returns table (user_id uuid)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  scope_mode text := coalesce(p_scope ->> 'mode', 'selected');
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin role required';
  end if;

  if scope_mode = 'all' then
    if not public.is_super_admin() then
      raise exception 'Super admin role required for all-user scope';
    end if;
    return query select account.id from auth.users account;
    return;
  end if;

  return query
  select distinct selection.value::uuid as user_id
  from jsonb_array_elements_text(coalesce(p_scope -> 'user_ids', '[]'::jsonb)) as selection(value)
  where exists (
    select 1
    from auth.users account
    where account.id = selection.value::uuid
  );
end;
$$;

create or replace function public.global_admin_preview_operation(
  p_action_type text,
  p_scope jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  target_ids uuid[];
  affected_users integer;
  affected_checkins integer;
  affected_diaries integer;
  affected_actions integer;
begin
  if p_action_type not in ('repair_references', 'migrate_occurred_at', 'export_account_package', 'full_factory_reset') then
    raise exception 'Unsupported admin operation';
  end if;

  select coalesce(array_agg(scope_user.user_id), '{}'::uuid[])
    into target_ids
  from public.global_admin_resolve_scope(p_scope) as scope_user;

  affected_users := cardinality(target_ids);
  if affected_users = 0 then
    raise exception 'Scope does not resolve to any user';
  end if;

  select count(*) into affected_checkins from public.checkins checkin_row where checkin_row.user_id = any(target_ids);
  select count(*) into affected_diaries from public.diary_entries diary_row where diary_row.user_id = any(target_ids) and diary_row.status <> 'deleted';
  select count(*) into affected_actions from public.reminders reminder_row where reminder_row.user_id = any(target_ids);

  return jsonb_build_object(
    'affected_users', affected_users,
    'checkins', affected_checkins,
    'diary_entries', affected_diaries,
    'reminders', affected_actions,
    'historical_snapshots_preserved', true,
    'rollback_available', false,
    'requires_strong_confirmation', p_action_type = 'full_factory_reset'
  );
end;
$$;

create or replace function public.global_admin_execute_operation(
  p_action_type text,
  p_scope jsonb,
  p_confirmation text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  target_ids uuid[];
  impact_preview jsonb;
  result_payload jsonb := '{}'::jsonb;
  operation_id uuid;
  target_count integer;
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin role required';
  end if;

  impact_preview := public.global_admin_preview_operation(p_action_type, p_scope);
  select coalesce(array_agg(scope_user.user_id), '{}'::uuid[]) into target_ids
  from public.global_admin_resolve_scope(p_scope) as scope_user;
  target_count := cardinality(target_ids);

  if p_action_type = 'full_factory_reset' then
    if not public.is_super_admin() then
      raise exception 'Super admin role required for full factory reset';
    end if;
    if p_confirmation <> ('RESET ' || target_count::text) then
      raise exception 'Typed confirmation must be RESET %', target_count;
    end if;
  elsif p_action_type in ('repair_references', 'migrate_occurred_at') then
    if p_confirmation <> ('APPLY ' || target_count::text) then
      raise exception 'Typed confirmation must be APPLY %', target_count;
    end if;
  end if;

  insert into public.platform_admin_operations (actor_id, action_type, scope, impact, status)
  values (current_user_id, p_action_type, p_scope, impact_preview, case when p_action_type = 'export_account_package' then 'queued' else 'previewed' end)
  returning id into operation_id;

  if p_action_type = 'repair_references' then
    result_payload := public.global_admin_reconcile_diary_links(target_ids);
  elsif p_action_type = 'migrate_occurred_at' then
    update public.checkins
    set occurred_at = created_at
    where checkins.user_id = any(target_ids)
      and checkins.occurred_at is null;
    result_payload := public.global_admin_reconcile_diary_links(target_ids)
      || jsonb_build_object('backfilled_occurred_at', true);
  elsif p_action_type = 'full_factory_reset' then
    update public.reminders
    set source_checkin_id = null
    where reminders.user_id = any(target_ids) and reminders.source_checkin_id is not null;
    delete from public.checkins where checkins.user_id = any(target_ids);
    delete from public.reminders where reminders.user_id = any(target_ids);
    update public.diary_entries
    set status = 'deleted', deleted_at = now()
    where diary_entries.user_id = any(target_ids) and diary_entries.status <> 'deleted';
    delete from public.future_letters where future_letters.user_id = any(target_ids);
    delete from public.gifts where gifts.user_id = any(target_ids);
    result_payload := jsonb_build_object('reset_users', target_count, 'historical_snapshots_preserved', false);
  else
    result_payload := jsonb_build_object('queue', 'account package export', 'target_users', target_count);
  end if;

  update public.platform_admin_operations
  set status = case when p_action_type = 'export_account_package' then 'queued' else 'completed' end,
      result = result_payload,
      completed_at = case when p_action_type = 'export_account_package' then null else now() end
  where platform_admin_operations.id = operation_id;

  return jsonb_build_object(
    'operation_id', operation_id,
    'status', case when p_action_type = 'export_account_package' then 'queued' else 'completed' end,
    'impact', impact_preview,
    'result', result_payload
  );
exception when others then
  if operation_id is not null then
    update public.platform_admin_operations
    set status = 'failed', result = jsonb_build_object('error', sqlerrm), completed_at = now()
    where platform_admin_operations.id = operation_id;
  end if;
  raise;
end;
$$;

revoke all on function public.global_admin_list_users(text, text, integer, integer) from public;
revoke all on function public.global_admin_resolve_scope(jsonb) from public;
revoke all on function public.global_admin_preview_operation(text, jsonb) from public;
revoke all on function public.global_admin_execute_operation(text, jsonb, text) from public;

grant execute on function public.global_admin_list_users(text, text, integer, integer) to authenticated;
grant execute on function public.global_admin_resolve_scope(jsonb) to authenticated;
grant execute on function public.global_admin_preview_operation(text, jsonb) to authenticated;
grant execute on function public.global_admin_execute_operation(text, jsonb, text) to authenticated;

commit;

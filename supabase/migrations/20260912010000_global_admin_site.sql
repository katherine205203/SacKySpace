begin;

-- Global Admin is a separate privileged surface. Existing single-owner access
-- is migrated forward so the current owner does not lose access.
create table if not exists public.platform_admin_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('platform_admin', 'super_admin')),
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.platform_admin_roles (user_id, role)
select user_id, 'super_admin'
from public.admin_owners
on conflict (user_id) do update
  set role = excluded.role,
      updated_at = now();

create table if not exists public.platform_admin_operations (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete restrict,
  action_type text not null check (action_type in (
    'repair_references',
    'migrate_occurred_at',
    'export_account_package',
    'full_factory_reset'
  )),
  scope jsonb not null,
  impact jsonb not null default '{}'::jsonb,
  status text not null check (status in ('previewed', 'queued', 'completed', 'failed')),
  result jsonb null,
  created_at timestamptz not null default now(),
  completed_at timestamptz null
);

create index if not exists platform_admin_operations_created_idx
  on public.platform_admin_operations (created_at desc);

create index if not exists platform_admin_operations_actor_idx
  on public.platform_admin_operations (actor_id, created_at desc);

create or replace function public.platform_admin_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists platform_admin_roles_touch_updated_at on public.platform_admin_roles;
create trigger platform_admin_roles_touch_updated_at
before update on public.platform_admin_roles
for each row execute function public.platform_admin_touch_updated_at();

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.platform_admin_roles
      where user_id = auth.uid()
    );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.platform_admin_roles
      where user_id = auth.uid()
        and role = 'super_admin'
    );
$$;

create or replace function public.current_platform_admin_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.platform_admin_roles
  where user_id = auth.uid()
  limit 1;
$$;

-- Preserve legacy policies while broadening their role boundary from the
-- original single owner to the explicit platform-admin role registry.
create or replace function public.is_admin_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin();
$$;

-- Self-claiming an admin role from a normal authenticated session is no longer
-- permitted. Bootstrap and role changes are managed by the platform owner.
revoke execute on function public.claim_admin_owner() from public, authenticated;

alter table public.platform_admin_roles enable row level security;
alter table public.platform_admin_operations enable row level security;

drop policy if exists platform_admin_roles_self_read on public.platform_admin_roles;
create policy platform_admin_roles_self_read
  on public.platform_admin_roles for select to authenticated
  using (user_id = auth.uid());

drop policy if exists platform_admin_operations_read on public.platform_admin_operations;
create policy platform_admin_operations_read
  on public.platform_admin_operations for select to authenticated
  using (public.is_platform_admin());

grant select on public.platform_admin_roles, public.platform_admin_operations to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.current_platform_admin_role() to authenticated;

create or replace function public.global_admin_identity()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
  admin_role text;
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin role required';
  end if;

  select email into current_email from auth.users where id = current_user_id;
  admin_role := public.current_platform_admin_role();

  return jsonb_build_object(
    'user_id', current_user_id,
    'email', coalesce(current_email, ''),
    'role', admin_role
  );
end;
$$;

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
    (select count(*) from public.checkins where user_id = account.id),
    (select count(*) from public.diary_entries where user_id = account.id and status <> 'deleted'),
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

create or replace function public.global_admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  recent_operations jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin role required';
  end if;

  select coalesce(jsonb_agg(to_jsonb(operation)), '[]'::jsonb)
    into recent_operations
  from (
    select id, action_type, status, scope, impact, created_at, completed_at
    from public.platform_admin_operations
    order by created_at desc
    limit 6
  ) operation;

  return jsonb_build_object(
    'total_users', (select count(*) from auth.users),
    'active_today', (select count(*) from auth.users where last_sign_in_at >= date_trunc('day', now())),
    'canonical_items',
      (select count(*) from public.emotions)
      + (select count(*) from public.needs)
      + (select count(*) from public.contexts)
      + (select count(*) from public.diary_prompts)
      + (select count(*) from public.care_actions),
    'pending_operations', (select count(*) from public.platform_admin_operations where status in ('previewed', 'queued')),
    'recent_operations', recent_operations
  );
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
    return query select id from auth.users;
    return;
  end if;

  return query
  select distinct value::uuid
  from jsonb_array_elements_text(coalesce(p_scope -> 'user_ids', '[]'::jsonb)) as selection(value)
  where exists (select 1 from auth.users where id = selection.value::uuid);
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

  select coalesce(array_agg(user_id), '{}'::uuid[])
    into target_ids
  from public.global_admin_resolve_scope(p_scope);

  affected_users := cardinality(target_ids);
  if affected_users = 0 then
    raise exception 'Scope does not resolve to any user';
  end if;

  select count(*) into affected_checkins from public.checkins where user_id = any(target_ids);
  select count(*) into affected_diaries from public.diary_entries where user_id = any(target_ids) and status <> 'deleted';
  select count(*) into affected_actions from public.reminders where user_id = any(target_ids);

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

create or replace function public.global_admin_reconcile_diary_links(p_target_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_diaries integer := 0;
  inserted_links integer := 0;
  removed_links integer := 0;
begin
  with missing_diaries as (
    insert into public.diary_entries (user_id, local_date, status, title, overall_text)
    select distinct
      checkin.user_id,
      (checkin.occurred_at at time zone 'Asia/Ho_Chi_Minh')::date,
      'draft',
      null,
      null
    from public.checkins checkin
    where checkin.user_id = any(p_target_ids)
      and not exists (
        select 1
        from public.diary_entries diary
        where diary.user_id = checkin.user_id
          and diary.local_date = (checkin.occurred_at at time zone 'Asia/Ho_Chi_Minh')::date
      )
    on conflict (user_id, local_date) do nothing
    returning id
  )
  select count(*) into inserted_diaries from missing_diaries;

  with desired_links as (
    select
      diary.id as diary_id,
      checkin.id as checkin_id,
      coalesce((
        select max(existing.position)
        from public.diary_checkin_links existing
        where existing.diary_id = diary.id
      ), 0) + row_number() over (
        partition by diary.id
        order by checkin.occurred_at, checkin.created_at, checkin.id
      )::smallint as position
    from public.checkins checkin
    join public.diary_entries diary
      on diary.user_id = checkin.user_id
      and diary.local_date = (checkin.occurred_at at time zone 'Asia/Ho_Chi_Minh')::date
    where checkin.user_id = any(p_target_ids)
      and not exists (
        select 1
        from public.diary_checkin_links existing
        where existing.diary_id = diary.id
          and existing.checkin_id = checkin.id
      )
  ), inserted as (
    insert into public.diary_checkin_links (diary_id, checkin_id, weight_percent, position)
    select diary_id, checkin_id, 100, position
    from desired_links
    on conflict (diary_id, checkin_id) do nothing
    returning checkin_id
  )
  select count(*) into inserted_links from inserted;

  delete from public.diary_checkin_links link
  using public.checkins checkin, public.diary_entries diary
  where link.checkin_id = checkin.id
    and link.diary_id = diary.id
    and checkin.user_id = any(p_target_ids)
    and diary.local_date <> (checkin.occurred_at at time zone 'Asia/Ho_Chi_Minh')::date;
  get diagnostics removed_links = row_count;

  return jsonb_build_object(
    'created_diaries', inserted_diaries,
    'attached_checkins', inserted_links,
    'reassigned_links', removed_links
  );
end;
$$;

-- This helper deliberately has no caller-facing grant. It can only run inside
-- the typed Global Admin operation below, after scope and role checks pass.
revoke all on function public.global_admin_reconcile_diary_links(uuid[]) from public, authenticated;

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
  select coalesce(array_agg(user_id), '{}'::uuid[]) into target_ids
  from public.global_admin_resolve_scope(p_scope);
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
    where user_id = any(target_ids)
      and occurred_at is null;
    result_payload := public.global_admin_reconcile_diary_links(target_ids)
      || jsonb_build_object('backfilled_occurred_at', true);
  elsif p_action_type = 'full_factory_reset' then
    update public.reminders set source_checkin_id = null where user_id = any(target_ids) and source_checkin_id is not null;
    delete from public.checkins where user_id = any(target_ids);
    delete from public.reminders where user_id = any(target_ids);
    update public.diary_entries set status = 'deleted', deleted_at = now() where user_id = any(target_ids) and status <> 'deleted';
    delete from public.future_letters where user_id = any(target_ids);
    delete from public.gifts where user_id = any(target_ids);
    result_payload := jsonb_build_object('reset_users', target_count, 'historical_snapshots_preserved', false);
  else
    result_payload := jsonb_build_object('queue', 'account package export', 'target_users', target_count);
  end if;

  update public.platform_admin_operations
  set status = case when p_action_type = 'export_account_package' then 'queued' else 'completed' end,
      result = result_payload,
      completed_at = case when p_action_type = 'export_account_package' then null else now() end
  where id = operation_id;

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
    where id = operation_id;
  end if;
  raise;
end;
$$;

revoke all on function public.global_admin_identity() from public;
revoke all on function public.global_admin_list_users(text, text, integer, integer) from public;
revoke all on function public.global_admin_overview() from public;
revoke all on function public.global_admin_resolve_scope(jsonb) from public;
revoke all on function public.global_admin_preview_operation(text, jsonb) from public;
revoke all on function public.global_admin_execute_operation(text, jsonb, text) from public;

grant execute on function public.global_admin_identity() to authenticated;
grant execute on function public.global_admin_list_users(text, text, integer, integer) to authenticated;
grant execute on function public.global_admin_overview() to authenticated;
grant execute on function public.global_admin_resolve_scope(jsonb) to authenticated;
grant execute on function public.global_admin_preview_operation(text, jsonb) to authenticated;
grant execute on function public.global_admin_execute_operation(text, jsonb, text) to authenticated;

commit;

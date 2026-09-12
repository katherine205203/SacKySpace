begin;

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
    coalesce(account.email, '')::text,
    account.created_at,
    account.last_sign_in_at,
    case when account.last_sign_in_at >= now() - interval '30 days' then 'active'::text else 'inactive'::text end,
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

revoke all on function public.global_admin_list_users(text, text, integer, integer) from public;
grant execute on function public.global_admin_list_users(text, text, integer, integer) to authenticated;

commit;

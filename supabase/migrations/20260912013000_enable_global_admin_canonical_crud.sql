begin;

-- Make the authorization boundary explicit in this migration. The policies
-- below are additive with the existing authenticated read policies, but only
-- the platform-admin role can write canonical data.
alter table public.emotion_families enable row level security;
alter table public.emotions enable row level security;
alter table public.need_groups enable row level security;
alter table public.needs enable row level security;
alter table public.contexts enable row level security;
alter table public.unknown_prompts enable row level security;
alter table public.care_actions enable row level security;
alter table public.diary_prompts enable row level security;
alter table public.action_reflection_outcomes enable row level security;
alter table public.gift_box_styles enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'emotion_families',
    'emotions',
    'need_groups',
    'needs',
    'contexts',
    'unknown_prompts',
    'care_actions',
    'diary_prompts',
    'action_reflection_outcomes',
    'gift_box_styles'
  ] loop
    execute format('drop policy if exists global_admin_canonical_insert on public.%I', table_name);
    execute format('create policy global_admin_canonical_insert on public.%I for insert to authenticated with check (public.is_platform_admin())', table_name);
    execute format('drop policy if exists global_admin_canonical_update on public.%I', table_name);
    execute format('create policy global_admin_canonical_update on public.%I for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin())', table_name);
    execute format('drop policy if exists global_admin_canonical_delete on public.%I', table_name);
    execute format('create policy global_admin_canonical_delete on public.%I for delete to authenticated using (public.is_platform_admin())', table_name);
  end loop;
end;
$$;

-- The explicit RLS policies above keep these table grants safe while allowing
-- the Global Admin surface to use PostgREST for CRUD.
grant select, insert, update, delete on public.emotion_families,
  public.emotions,
  public.need_groups,
  public.needs,
  public.contexts,
  public.unknown_prompts,
  public.care_actions,
  public.diary_prompts,
  public.action_reflection_outcomes,
  public.gift_box_styles to authenticated;

commit;

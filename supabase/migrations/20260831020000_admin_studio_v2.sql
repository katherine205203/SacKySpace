begin;

-- Admin Studio v2 is a control plane, not a raw database editor. The owner table
-- is intentionally single-row for the current single-owner product.
create table if not exists public.admin_owners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  advanced_mode boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.admin_settings add column if not exists updated_by uuid null references auth.users(id) on delete set null;

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  domain text not null,
  action text not null,
  entity_type text null,
  target_id text null,
  before_json jsonb null,
  after_json jsonb null,
  version integer null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_runtime_configs (
  config_key text primary key,
  module text not null,
  value_type text not null check (value_type in ('number', 'boolean', 'text', 'json')),
  scope text not null default 'global',
  default_value jsonb not null,
  published_value jsonb not null,
  draft_value jsonb not null,
  configurability_level text not null default 'advanced' check (configurability_level in ('basic', 'advanced')),
  validation_schema jsonb not null default '{}'::jsonb,
  dependency_tags text[] not null default '{}',
  published_version integer not null default 0 check (published_version >= 0),
  effective_from timestamptz null,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null
);

create table if not exists public.admin_runtime_config_versions (
  id uuid primary key default gen_random_uuid(),
  config_key text not null references public.admin_runtime_configs(config_key) on delete cascade,
  version integer not null check (version > 0),
  value jsonb not null,
  status text not null check (status in ('published', 'rollback')),
  change_note text null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (config_key, version)
);

create table if not exists public.admin_asset_registry (
  asset_id text primary key,
  asset_type text not null,
  name text not null,
  preview_url text null,
  active boolean not null default true,
  sort_order integer not null default 0,
  provider text not null default 'external',
  current_version integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null
);

create table if not exists public.admin_asset_versions (
  id uuid primary key default gen_random_uuid(),
  asset_id text not null references public.admin_asset_registry(asset_id) on delete cascade,
  version integer not null check (version > 0),
  preview_url text null,
  metadata jsonb not null default '{}'::jsonb,
  provider text not null default 'external',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (asset_id, version)
);

create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs (created_at desc);
create index if not exists admin_audit_logs_domain_idx on public.admin_audit_logs (domain, action);

create or replace function public.is_admin_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (select 1 from public.admin_owners where user_id = auth.uid());
$$;

create or replace function public.claim_admin_owner()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if exists (select 1 from public.admin_owners where user_id = current_user_id) then return true; end if;
  if exists (select 1 from public.admin_owners) then return false; end if;
  insert into public.admin_owners(user_id) values (current_user_id);
  insert into public.admin_settings(user_id) values (current_user_id) on conflict do nothing;
  return true;
end;
$$;

create or replace function public.admin_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists admin_settings_updated_at on public.admin_settings;
create trigger admin_settings_updated_at before update on public.admin_settings for each row execute function public.admin_touch_updated_at();
drop trigger if exists admin_runtime_configs_updated_at on public.admin_runtime_configs;
create trigger admin_runtime_configs_updated_at before update on public.admin_runtime_configs for each row execute function public.admin_touch_updated_at();
drop trigger if exists admin_asset_registry_updated_at on public.admin_asset_registry;
create trigger admin_asset_registry_updated_at before update on public.admin_asset_registry for each row execute function public.admin_touch_updated_at();

insert into public.admin_runtime_configs (config_key, module, value_type, scope, default_value, published_value, draft_value, configurability_level, validation_schema, dependency_tags, published_version)
values
  ('checkin.max_secondary_emotions', 'Check-in', 'number', 'global', '2', '2', '2', 'basic', '{"min":0,"max":6}', array['checkin.selection','checkin_secondary_emotions'], 1),
  ('checkin.max_needs', 'Check-in', 'number', 'global', '3', '3', '3', 'basic', '{"min":0,"max":8}', array['checkin.selection','checkin_needs'], 1),
  ('checkin.max_contexts', 'Check-in', 'number', 'global', '2', '2', '2', 'basic', '{"min":0,"max":8}', array['checkin.selection','checkin_contexts'], 1),
  ('checkin.max_active_actions', 'Check-in', 'number', 'global', '2', '2', '2', 'basic', '{"min":0,"max":8}', array['checkin.actions','reminders'], 1),
  ('diary.max_prompts', 'Diary', 'number', 'global', '6', '6', '6', 'basic', '{"min":0,"max":12}', array['diary.prompts','diary_prompt_responses'], 1),
  ('diary.max_images', 'Diary', 'number', 'global', '4', '4', '4', 'basic', '{"min":0,"max":12}', array['diary.images','diary_images'], 1),
  ('future_letter.random_daily_chance', 'Future Letter', 'number', 'global', '0.3', '0.3', '0.3', 'advanced', '{"min":0,"max":1}', array['future_letter.random','future_letter_random_rolls'], 1),
  ('gift.cutoff_local_time', 'Gift for Tomorrow', 'text', 'Asia/Ho_Chi_Minh', '"23:30"', '"23:30"', '"23:30"', 'basic', '{"pattern":"^[0-2][0-9]:[0-5][0-9]$"}', array['gift.lock','gifts'], 1),
  ('gift.delivery_local_time', 'Gift for Tomorrow', 'text', 'Asia/Ho_Chi_Minh', '"03:00"', '"03:00"', '"03:00"', 'basic', '{"pattern":"^[0-2][0-9]:[0-5][0-9]$"}', array['gift.delivery','gifts'], 1),
  ('gift.home_expiry_local_time', 'Gift for Tomorrow', 'text', 'Asia/Ho_Chi_Minh', '"23:30"', '"23:30"', '"23:30"', 'basic', '{"pattern":"^[0-2][0-9]:[0-5][0-9]$"}', array['gift.home','gifts'], 1)
on conflict (config_key) do nothing;

insert into public.admin_asset_registry(asset_id, asset_type, name, provider, sort_order)
values
  ('envelope-paper', 'future_letter_envelope', 'Giấy thư', 'catalog', 1),
  ('envelope-night', 'future_letter_envelope', 'Đêm tím', 'catalog', 2),
  ('envelope-garden', 'future_letter_envelope', 'Khu vườn', 'catalog', 3),
  ('envelope-sunrise', 'future_letter_envelope', 'Bình minh', 'catalog', 4),
  ('seal-violet', 'future_letter_seal', 'Ấn tím', 'catalog', 5),
  ('seal-rose', 'future_letter_seal', 'Ấn hồng', 'catalog', 6),
  ('seal-amber', 'future_letter_seal', 'Ấn hổ phách', 'catalog', 7),
  ('seal-forest', 'future_letter_seal', 'Ấn rừng', 'catalog', 8)
on conflict (asset_id) do nothing;

alter table public.admin_owners enable row level security;
alter table public.admin_settings enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.admin_runtime_configs enable row level security;
alter table public.admin_runtime_config_versions enable row level security;
alter table public.admin_asset_registry enable row level security;
alter table public.admin_asset_versions enable row level security;

drop policy if exists admin_owner_self on public.admin_owners;
create policy admin_owner_self on public.admin_owners for select to authenticated using (user_id = auth.uid());
drop policy if exists admin_settings_owner on public.admin_settings;
create policy admin_settings_owner on public.admin_settings for all to authenticated using (public.is_admin_owner() and user_id = auth.uid()) with check (public.is_admin_owner() and user_id = auth.uid());
drop policy if exists admin_audit_owner on public.admin_audit_logs;
create policy admin_audit_owner on public.admin_audit_logs for all to authenticated using (public.is_admin_owner() and user_id = auth.uid()) with check (public.is_admin_owner() and user_id = auth.uid());
drop policy if exists admin_configs_owner on public.admin_runtime_configs;
create policy admin_configs_owner on public.admin_runtime_configs for all to authenticated using (public.is_admin_owner()) with check (public.is_admin_owner());
drop policy if exists admin_config_versions_owner on public.admin_runtime_config_versions;
create policy admin_config_versions_owner on public.admin_runtime_config_versions for select to authenticated using (public.is_admin_owner());
drop policy if exists admin_assets_owner on public.admin_asset_registry;
create policy admin_assets_owner on public.admin_asset_registry for all to authenticated using (public.is_admin_owner()) with check (public.is_admin_owner());
drop policy if exists admin_asset_versions_owner on public.admin_asset_versions;
create policy admin_asset_versions_owner on public.admin_asset_versions for select to authenticated using (public.is_admin_owner());

-- Registered reference entities remain typed and controlled; they are not exposed as arbitrary tables.
drop policy if exists admin_update_emotion_families on public.emotion_families;
create policy admin_update_emotion_families on public.emotion_families for update to authenticated using (public.is_admin_owner()) with check (public.is_admin_owner());
drop policy if exists admin_delete_emotion_families on public.emotion_families;
create policy admin_delete_emotion_families on public.emotion_families for delete to authenticated using (public.is_admin_owner());
drop policy if exists admin_insert_emotion_families on public.emotion_families;
create policy admin_insert_emotion_families on public.emotion_families for insert to authenticated with check (public.is_admin_owner());
drop policy if exists admin_update_emotions on public.emotions;
create policy admin_update_emotions on public.emotions for update to authenticated using (public.is_admin_owner()) with check (public.is_admin_owner());
drop policy if exists admin_delete_emotions on public.emotions;
create policy admin_delete_emotions on public.emotions for delete to authenticated using (public.is_admin_owner());
drop policy if exists admin_insert_emotions on public.emotions;
create policy admin_insert_emotions on public.emotions for insert to authenticated with check (public.is_admin_owner());
drop policy if exists admin_update_need_groups on public.need_groups;
create policy admin_update_need_groups on public.need_groups for update to authenticated using (public.is_admin_owner()) with check (public.is_admin_owner());
drop policy if exists admin_delete_need_groups on public.need_groups;
create policy admin_delete_need_groups on public.need_groups for delete to authenticated using (public.is_admin_owner());
drop policy if exists admin_insert_need_groups on public.need_groups;
create policy admin_insert_need_groups on public.need_groups for insert to authenticated with check (public.is_admin_owner());
drop policy if exists admin_update_needs on public.needs;
create policy admin_update_needs on public.needs for update to authenticated using (public.is_admin_owner()) with check (public.is_admin_owner());
drop policy if exists admin_delete_needs on public.needs;
create policy admin_delete_needs on public.needs for delete to authenticated using (public.is_admin_owner());
drop policy if exists admin_insert_needs on public.needs;
create policy admin_insert_needs on public.needs for insert to authenticated with check (public.is_admin_owner());
drop policy if exists admin_update_contexts on public.contexts;
create policy admin_update_contexts on public.contexts for update to authenticated using (public.is_admin_owner()) with check (public.is_admin_owner());
drop policy if exists admin_delete_contexts on public.contexts;
create policy admin_delete_contexts on public.contexts for delete to authenticated using (public.is_admin_owner());
drop policy if exists admin_insert_contexts on public.contexts;
create policy admin_insert_contexts on public.contexts for insert to authenticated with check (public.is_admin_owner());
drop policy if exists admin_update_unknown_prompts on public.unknown_prompts;
create policy admin_update_unknown_prompts on public.unknown_prompts for update to authenticated using (public.is_admin_owner()) with check (public.is_admin_owner());
drop policy if exists admin_delete_unknown_prompts on public.unknown_prompts;
create policy admin_delete_unknown_prompts on public.unknown_prompts for delete to authenticated using (public.is_admin_owner());
drop policy if exists admin_insert_unknown_prompts on public.unknown_prompts;
create policy admin_insert_unknown_prompts on public.unknown_prompts for insert to authenticated with check (public.is_admin_owner());
drop policy if exists admin_update_care_actions on public.care_actions;
create policy admin_update_care_actions on public.care_actions for update to authenticated using (public.is_admin_owner()) with check (public.is_admin_owner());
drop policy if exists admin_delete_care_actions on public.care_actions;
create policy admin_delete_care_actions on public.care_actions for delete to authenticated using (public.is_admin_owner());
drop policy if exists admin_insert_care_actions on public.care_actions;
create policy admin_insert_care_actions on public.care_actions for insert to authenticated with check (public.is_admin_owner());
drop policy if exists admin_update_diary_prompts on public.diary_prompts;
create policy admin_update_diary_prompts on public.diary_prompts for update to authenticated using (public.is_admin_owner()) with check (public.is_admin_owner());
drop policy if exists admin_delete_diary_prompts on public.diary_prompts;
create policy admin_delete_diary_prompts on public.diary_prompts for delete to authenticated using (public.is_admin_owner());
drop policy if exists admin_insert_diary_prompts on public.diary_prompts;
create policy admin_insert_diary_prompts on public.diary_prompts for insert to authenticated with check (public.is_admin_owner());
drop policy if exists admin_update_reflection_outcomes on public.action_reflection_outcomes;
create policy admin_update_reflection_outcomes on public.action_reflection_outcomes for update to authenticated using (public.is_admin_owner()) with check (public.is_admin_owner());
drop policy if exists admin_delete_reflection_outcomes on public.action_reflection_outcomes;
create policy admin_delete_reflection_outcomes on public.action_reflection_outcomes for delete to authenticated using (public.is_admin_owner());
drop policy if exists admin_insert_reflection_outcomes on public.action_reflection_outcomes;
create policy admin_insert_reflection_outcomes on public.action_reflection_outcomes for insert to authenticated with check (public.is_admin_owner());
drop policy if exists admin_update_gift_box_styles on public.gift_box_styles;
create policy admin_update_gift_box_styles on public.gift_box_styles for update to authenticated using (public.is_admin_owner()) with check (public.is_admin_owner());
drop policy if exists admin_delete_gift_box_styles on public.gift_box_styles;
create policy admin_delete_gift_box_styles on public.gift_box_styles for delete to authenticated using (public.is_admin_owner());
drop policy if exists admin_insert_gift_box_styles on public.gift_box_styles;
create policy admin_insert_gift_box_styles on public.gift_box_styles for insert to authenticated with check (public.is_admin_owner());

grant execute on function public.is_admin_owner() to authenticated;
grant execute on function public.claim_admin_owner() to authenticated;
grant select, insert, update on public.admin_settings, public.admin_audit_logs, public.admin_runtime_configs, public.admin_asset_registry to authenticated;
grant select on public.admin_owners, public.admin_runtime_config_versions, public.admin_asset_versions to authenticated;

create or replace function public.admin_publish_runtime_config(p_config_key text, p_change_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  config_row public.admin_runtime_configs%rowtype;
  next_version integer;
begin
  if not public.is_admin_owner() then raise exception 'Admin owner required'; end if;
  select * into config_row from public.admin_runtime_configs where config_key = p_config_key for update;
  if not found then raise exception 'Config not found'; end if;
  next_version := config_row.published_version + 1;
  insert into public.admin_runtime_config_versions(config_key, version, value, status, change_note, created_by)
  values (p_config_key, next_version, config_row.draft_value, 'published', nullif(btrim(p_change_note), ''), current_user_id);
  update public.admin_runtime_configs set published_value = config_row.draft_value, published_version = next_version, effective_from = now() where config_key = p_config_key;
  insert into public.admin_audit_logs(user_id, domain, action, entity_type, target_id, before_json, after_json, version)
  values (current_user_id, 'rules', 'publish', 'admin_runtime_configs', p_config_key, config_row.published_value, config_row.draft_value, next_version);
  return jsonb_build_object('config_key', p_config_key, 'version', next_version);
end;
$$;

create or replace function public.admin_rollback_runtime_config(p_config_key text, p_version integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  version_row public.admin_runtime_config_versions%rowtype;
  next_version integer;
begin
  if not public.is_admin_owner() then raise exception 'Admin owner required'; end if;
  select * into version_row from public.admin_runtime_config_versions where config_key = p_config_key and version = p_version;
  if not found then raise exception 'Config version not found'; end if;
  select published_version + 1 into next_version from public.admin_runtime_configs where config_key = p_config_key for update;
  insert into public.admin_runtime_config_versions(config_key, version, value, status, change_note, created_by)
  values (p_config_key, next_version, version_row.value, 'rollback', concat('Rollback về version ', p_version), current_user_id);
  update public.admin_runtime_configs set published_value = version_row.value, draft_value = version_row.value, published_version = next_version, effective_from = now() where config_key = p_config_key;
  insert into public.admin_audit_logs(user_id, domain, action, entity_type, target_id, before_json, after_json, version)
  values (current_user_id, 'rules', 'rollback', 'admin_runtime_configs', p_config_key, null, version_row.value, next_version);
  return jsonb_build_object('config_key', p_config_key, 'version', next_version, 'rolled_back_from', p_version);
end;
$$;

create or replace function public.admin_reset_module(p_module text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  removed_count integer := 0;
  result jsonb;
begin
  if not public.is_admin_owner() then raise exception 'Admin owner required'; end if;
  if p_module = 'checkin' then
    update public.reminders set source_checkin_id = null where user_id = current_user_id and source_checkin_id is not null;
    delete from public.checkins where user_id = current_user_id;
    get diagnostics removed_count = row_count;
  elsif p_module = 'diary' then
    update public.diary_entries set status = 'deleted', deleted_at = now() where user_id = current_user_id and status <> 'deleted';
    get diagnostics removed_count = row_count;
  elsif p_module = 'action_space' then
    delete from public.reminders where user_id = current_user_id;
    get diagnostics removed_count = row_count;
  elsif p_module = 'future_letter' then
    delete from public.future_letters where user_id = current_user_id;
    get diagnostics removed_count = row_count;
  elsif p_module = 'gift' then
    delete from public.gifts where user_id = current_user_id;
    get diagnostics removed_count = row_count;
  else
    raise exception 'Unsupported module reset';
  end if;
  insert into public.admin_audit_logs(user_id, domain, action, entity_type, target_id, after_json)
  values (current_user_id, 'recovery', 'module_reset', 'user_data', p_module, jsonb_build_object('removed_count', removed_count));
  result := jsonb_build_object('module', p_module, 'removed_count', removed_count, 'completed_at', now());
  return result;
end;
$$;

create or replace function public.admin_full_reset(p_confirmation text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  result jsonb;
begin
  if not public.is_admin_owner() then raise exception 'Admin owner required'; end if;
  if p_confirmation <> 'RESET' then raise exception 'Typed confirmation required'; end if;
  result := jsonb_build_object(
    'checkins', (select count(*) from public.checkins where user_id = current_user_id),
    'actions', (select count(*) from public.reminders where user_id = current_user_id),
    'diary_entries', (select count(*) from public.diary_entries where user_id = current_user_id and status <> 'deleted'),
    'future_letters', (select count(*) from public.future_letters where user_id = current_user_id),
    'gifts', (select count(*) from public.gifts where user_id = current_user_id)
  );
  delete from public.checkins where user_id = current_user_id;
  delete from public.reminders where user_id = current_user_id;
  update public.diary_entries set status = 'deleted', deleted_at = now() where user_id = current_user_id and status <> 'deleted';
  delete from public.future_letters where user_id = current_user_id;
  delete from public.gifts where user_id = current_user_id;
  insert into public.admin_audit_logs(user_id, domain, action, entity_type, target_id, after_json)
  values (current_user_id, 'recovery', 'full_reset', 'user_data', current_user_id::text, result);
  return result || jsonb_build_object('completed_at', now());
end;
$$;

grant execute on function public.admin_publish_runtime_config(text, text) to authenticated;
grant execute on function public.admin_rollback_runtime_config(text, integer) to authenticated;
grant execute on function public.admin_reset_module(text) to authenticated;
grant execute on function public.admin_full_reset(text) to authenticated;

-- Runtime consumers read the published registry. The old constants remain only
-- as client-side UX fallbacks when a remote schema is unavailable.
create or replace function public.admin_runtime_number(p_config_key text, p_fallback numeric)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select (published_value #>> '{}')::numeric from public.admin_runtime_configs where config_key = p_config_key), p_fallback);
$$;

create or replace function public.admin_runtime_text(p_config_key text, p_fallback text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select published_value #>> '{}' from public.admin_runtime_configs where config_key = p_config_key), p_fallback);
$$;

create or replace function public.validate_secondary_emotion_limit()
returns trigger
language plpgsql
as $$
declare
  primary_emotion text;
  relation_count integer;
  selection_limit integer := public.admin_runtime_number('checkin.max_secondary_emotions', 2)::integer;
begin
  select primary_emotion_id into primary_emotion from public.checkins where id = new.checkin_id;
  if primary_emotion = new.emotion_id then raise exception 'Primary emotion cannot also be a secondary emotion'; end if;
  select count(*) into relation_count from public.checkin_secondary_emotions where checkin_id = new.checkin_id and not (tg_op = 'UPDATE' and checkin_id = old.checkin_id and emotion_id = old.emotion_id);
  if relation_count >= selection_limit then raise exception 'A check-in has reached its secondary emotion limit'; end if;
  return new;
end;
$$;

create or replace function public.validate_need_limit()
returns trigger
language plpgsql
as $$
declare
  relation_count integer;
  selection_limit integer := public.admin_runtime_number('checkin.max_needs', 3)::integer;
begin
  select count(*) into relation_count from public.checkin_needs where checkin_id = new.checkin_id and not (tg_op = 'UPDATE' and checkin_id = old.checkin_id and need_id = old.need_id);
  if relation_count >= selection_limit then raise exception 'A check-in has reached its needs limit'; end if;
  return new;
end;
$$;

create or replace function public.validate_context_limit()
returns trigger
language plpgsql
as $$
declare
  relation_count integer;
  selection_limit integer := public.admin_runtime_number('checkin.max_contexts', 2)::integer;
begin
  select count(*) into relation_count from public.checkin_contexts where checkin_id = new.checkin_id and not (tg_op = 'UPDATE' and checkin_id = old.checkin_id and context_id = old.context_id);
  if relation_count >= selection_limit then raise exception 'A check-in has reached its context limit'; end if;
  return new;
end;
$$;

create or replace function public.validate_checkin_reminder_limit()
returns trigger
language plpgsql
as $$
declare
  relation_count integer;
  action_limit integer := public.admin_runtime_number('checkin.max_active_actions', 2)::integer;
begin
  if new.source_checkin_id is not null and new.status <> 'completed' then
    select count(*) into relation_count from public.reminders where source_checkin_id = new.source_checkin_id and status <> 'completed' and not (tg_op = 'UPDATE' and id = old.id);
    if relation_count >= action_limit then raise exception 'A check-in has reached its active action limit'; end if;
  end if;
  return new;
end;
$$;

create or replace function public.gift_before_write()
returns trigger
language plpgsql
as $$
declare
  cutoff timestamptz;
begin
  if tg_op = 'INSERT' and new.creation_local_date <> (now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'Gift chỉ được tạo cho ngày hôm nay'; end if;
  if tg_op = 'UPDATE' then
    cutoff := (old.creation_local_date::text || ' ' || public.admin_runtime_text('gift.cutoff_local_time', '23:30') || ' Asia/Ho_Chi_Minh')::timestamptz;
    if new.user_id is distinct from old.user_id or new.creation_local_date is distinct from old.creation_local_date then raise exception 'Gift owner and creation date are immutable'; end if;
    if old.status = 'draft' and (now() >= cutoff or old.creation_local_date <> (now() at time zone 'Asia/Ho_Chi_Minh')::date) then raise exception 'Bản nháp Gift đã hết hạn'; end if;
    if old.status = 'sent' then
      if new.sent_at is distinct from old.sent_at or new.locked_at is distinct from old.locked_at or new.deliver_at is distinct from old.deliver_at then raise exception 'Lịch gửi của Gift đã được niêm phong'; end if;
      if new.status is distinct from old.status and not (new.status = 'delivered' and old.deliver_at is not null and now() >= old.deliver_at) then raise exception 'Gift chỉ có thể chuyển sang delivered sau giờ giao'; end if;
    end if;
    if old.status = 'sent' and old.locked_at is not null and now() >= old.locked_at then
      if new.status = 'delivered' and old.deliver_at is not null and now() >= old.deliver_at then
        if new.type is distinct from old.type or new.question_text is distinct from old.question_text or new.message_text is distinct from old.message_text or new.emotion_id is distinct from old.emotion_id or new.box_style_id is distinct from old.box_style_id or new.box_style_snapshot is distinct from old.box_style_snapshot or new.sent_at is distinct from old.sent_at or new.locked_at is distinct from old.locked_at or new.deliver_at is distinct from old.deliver_at then raise exception 'Gift đã khóa và không thể chỉnh sửa'; end if;
      elsif new.status is distinct from old.status or new.type is distinct from old.type or new.question_text is distinct from old.question_text or new.message_text is distinct from old.message_text or new.emotion_id is distinct from old.emotion_id or new.box_style_id is distinct from old.box_style_id or new.box_style_snapshot is distinct from old.box_style_snapshot then raise exception 'Gift đã khóa và không thể chỉnh sửa'; end if;
    elsif old.status = 'delivered' then
      if new.status is distinct from old.status or new.type is distinct from old.type or new.question_text is distinct from old.question_text or new.message_text is distinct from old.message_text or new.emotion_id is distinct from old.emotion_id or new.box_style_id is distinct from old.box_style_id or new.box_style_snapshot is distinct from old.box_style_snapshot or new.sent_at is distinct from old.sent_at or new.locked_at is distinct from old.locked_at or new.deliver_at is distinct from old.deliver_at or new.delivered_at is distinct from old.delivered_at then raise exception 'Gift đã đến và chỉ còn mở quà hoặc phản hồi'; end if;
    end if;
  end if;
  if new.type = 'question' and new.status = 'sent' and coalesce(btrim(new.question_text), '') = '' then raise exception 'Câu hỏi không được để trống'; end if;
  if new.type = 'message' and new.status = 'sent' and coalesce(btrim(new.message_text), '') = '' then raise exception 'Lời nhắn không được để trống'; end if;
  new.updated_at = now(); return new;
end;
$$;

create or replace function public.send_gift(
  p_gift_id uuid, p_question_text text, p_message_text text, p_emotion_id text,
  p_emotion_snapshot jsonb, p_box_style_id text, p_box_style_snapshot jsonb
)
returns public.gifts
language plpgsql
security invoker
as $$
declare
  gift public.gifts;
  cutoff timestamptz;
  local_day date;
  delivery_at timestamptz;
begin
  select * into gift from public.gifts where id = p_gift_id and user_id = auth.uid() for update;
  if gift.id is null then raise exception 'Không tìm thấy Gift'; end if;
  local_day := gift.creation_local_date;
  cutoff := (local_day::text || ' ' || public.admin_runtime_text('gift.cutoff_local_time', '23:30') || ' Asia/Ho_Chi_Minh')::timestamptz;
  delivery_at := ((local_day + 1)::text || ' ' || public.admin_runtime_text('gift.delivery_local_time', '03:00') || ' Asia/Ho_Chi_Minh')::timestamptz;
  if now() >= cutoff then raise exception 'Đã quá giờ khóa, món quà này đã khóa'; end if;
  if gift.type = 'question' and coalesce(btrim(p_question_text), '') = '' then raise exception 'Câu hỏi không được để trống'; end if;
  if gift.type = 'message' and coalesce(btrim(p_message_text), '') = '' then raise exception 'Lời nhắn không được để trống'; end if;
  update public.gifts set status = 'sent', question_text = case when gift.type = 'question' then btrim(p_question_text) else null end, message_text = case when gift.type = 'message' then btrim(p_message_text) else null end, emotion_id = p_emotion_id, emotion_snapshot = p_emotion_snapshot, box_style_id = coalesce(p_box_style_id, gift.box_style_id), box_style_snapshot = p_box_style_snapshot, sent_at = coalesce(sent_at, now()), locked_at = cutoff, deliver_at = delivery_at where id = gift.id returning * into gift;
  return gift;
end;
$$;

create or replace function public.sync_gift_lifecycle()
returns void
language plpgsql
security invoker
as $$
begin
  update public.gifts set status = 'delivered', delivered_at = coalesce(delivered_at, now()) where user_id = auth.uid() and status = 'sent' and deliver_at is not null and now() >= deliver_at;
  delete from public.gifts where user_id = auth.uid() and status = 'draft' and (creation_local_date < (now() at time zone 'Asia/Ho_Chi_Minh')::date or (creation_local_date = (now() at time zone 'Asia/Ho_Chi_Minh')::date and (now() at time zone 'Asia/Ho_Chi_Minh')::time >= public.admin_runtime_text('gift.cutoff_local_time', '23:30')::time));
end;
$$;

grant execute on function public.admin_runtime_number(text, numeric) to authenticated;
grant execute on function public.admin_runtime_text(text, text) to authenticated;

commit;

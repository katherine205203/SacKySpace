-- FutureMe / Future Letter v2. Additive schema: no existing product table is renamed.
begin;

create table if not exists public.future_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  body text not null default '',
  lifecycle_state text not null default 'draft' check (lifecycle_state in ('draft', 'writing', 'decorating', 'preview', 'sealed_waiting', 'available_unopened', 'opened', 'archived')),
  group_operator text not null default 'OR' check (group_operator in ('AND', 'OR')),
  envelope_asset_id text null,
  seal_asset_id text null,
  decoration_snapshot jsonb null,
  opened_count integer not null default 0 check (opened_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sealed_at timestamptz null,
  first_opened_at timestamptz null,
  last_opened_at timestamptz null,
  archived_at timestamptz null
);

create table if not exists public.future_letter_context_attachments (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid not null references public.future_letters(id) on delete cascade,
  attachment_type text not null check (attachment_type in ('emotion', 'checkin')),
  ref_id text not null,
  snapshot jsonb null,
  position smallint not null default 1 check (position > 0)
);

create table if not exists public.future_letter_rule_groups (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid not null references public.future_letters(id) on delete cascade,
  group_operator text not null check (group_operator in ('AND', 'OR')),
  position smallint not null default 1 check (position > 0)
);

create table if not exists public.future_letter_rules (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.future_letter_rule_groups(id) on delete cascade,
  rule_type text not null check (rule_type in ('random_date', 'specific_date', 'checkin_streak', 'diary_streak', 'emotion_frequency', 'done_action')),
  comparator text null check (comparator in ('>', '>=', '=', '<=', '<')),
  threshold numeric null,
  config_json jsonb not null default '{}'::jsonb,
  position smallint not null default 1 check (position > 0)
);

create table if not exists public.future_letter_trigger_events (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid not null references public.future_letters(id) on delete cascade,
  dedupe_key text not null unique,
  trigger_type text not null check (trigger_type in ('random_date', 'specific_date', 'checkin_streak', 'diary_streak', 'emotion_frequency', 'done_action')),
  rule_snapshot jsonb not null default '{}'::jsonb,
  observed_values jsonb not null default '{}'::jsonb,
  window_start date null,
  window_end date null,
  triggered_at timestamptz not null default now(),
  available_since timestamptz not null default now(),
  opened_at timestamptz null,
  source_ref_ids text[] not null default '{}'
);

create table if not exists public.future_letter_random_rolls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  daily_chance numeric not null default 0.3 check (daily_chance >= 0 and daily_chance <= 1),
  rolled boolean not null default false,
  selected_letter_id uuid null references public.future_letters(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, local_date)
);

create index if not exists future_letters_user_state_idx on public.future_letters (user_id, lifecycle_state, updated_at desc);
create index if not exists future_letter_attachments_letter_idx on public.future_letter_context_attachments (letter_id, position);
create index if not exists future_letter_rule_groups_letter_idx on public.future_letter_rule_groups (letter_id, position);
create index if not exists future_letter_rules_group_idx on public.future_letter_rules (group_id, position);
create index if not exists future_letter_trigger_events_letter_idx on public.future_letter_trigger_events (letter_id, triggered_at desc);

drop trigger if exists future_letters_set_updated_at on public.future_letters;
create trigger future_letters_set_updated_at before update on public.future_letters for each row execute function public.set_updated_at();

alter table public.future_letters enable row level security;
alter table public.future_letter_context_attachments enable row level security;
alter table public.future_letter_rule_groups enable row level security;
alter table public.future_letter_rules enable row level security;
alter table public.future_letter_trigger_events enable row level security;
alter table public.future_letter_random_rolls enable row level security;

drop policy if exists owner_select_future_letters on public.future_letters;
create policy owner_select_future_letters on public.future_letters for select to authenticated using (auth.uid() = user_id);
drop policy if exists owner_insert_future_letters on public.future_letters;
create policy owner_insert_future_letters on public.future_letters for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists owner_update_future_letters on public.future_letters;
create policy owner_update_future_letters on public.future_letters for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists owner_delete_future_letters on public.future_letters;
create policy owner_delete_future_letters on public.future_letters for delete to authenticated using (auth.uid() = user_id);

drop policy if exists owner_select_future_letter_attachments on public.future_letter_context_attachments;
create policy owner_select_future_letter_attachments on public.future_letter_context_attachments for select to authenticated using (exists (select 1 from public.future_letters l where l.id = letter_id and l.user_id = auth.uid()));
drop policy if exists owner_insert_future_letter_attachments on public.future_letter_context_attachments;
create policy owner_insert_future_letter_attachments on public.future_letter_context_attachments for insert to authenticated with check (exists (select 1 from public.future_letters l where l.id = letter_id and l.user_id = auth.uid()));
drop policy if exists owner_update_future_letter_attachments on public.future_letter_context_attachments;
create policy owner_update_future_letter_attachments on public.future_letter_context_attachments for update to authenticated using (exists (select 1 from public.future_letters l where l.id = letter_id and l.user_id = auth.uid())) with check (exists (select 1 from public.future_letters l where l.id = letter_id and l.user_id = auth.uid()));
drop policy if exists owner_delete_future_letter_attachments on public.future_letter_context_attachments;
create policy owner_delete_future_letter_attachments on public.future_letter_context_attachments for delete to authenticated using (exists (select 1 from public.future_letters l where l.id = letter_id and l.user_id = auth.uid()));

drop policy if exists owner_select_future_letter_rule_groups on public.future_letter_rule_groups;
create policy owner_select_future_letter_rule_groups on public.future_letter_rule_groups for select to authenticated using (exists (select 1 from public.future_letters l where l.id = letter_id and l.user_id = auth.uid()));
drop policy if exists owner_insert_future_letter_rule_groups on public.future_letter_rule_groups;
create policy owner_insert_future_letter_rule_groups on public.future_letter_rule_groups for insert to authenticated with check (exists (select 1 from public.future_letters l where l.id = letter_id and l.user_id = auth.uid()));
drop policy if exists owner_update_future_letter_rule_groups on public.future_letter_rule_groups;
create policy owner_update_future_letter_rule_groups on public.future_letter_rule_groups for update to authenticated using (exists (select 1 from public.future_letters l where l.id = letter_id and l.user_id = auth.uid())) with check (exists (select 1 from public.future_letters l where l.id = letter_id and l.user_id = auth.uid()));
drop policy if exists owner_delete_future_letter_rule_groups on public.future_letter_rule_groups;
create policy owner_delete_future_letter_rule_groups on public.future_letter_rule_groups for delete to authenticated using (exists (select 1 from public.future_letters l where l.id = letter_id and l.user_id = auth.uid()));

drop policy if exists owner_select_future_letter_rules on public.future_letter_rules;
create policy owner_select_future_letter_rules on public.future_letter_rules for select to authenticated using (exists (select 1 from public.future_letter_rule_groups g join public.future_letters l on l.id = g.letter_id where g.id = group_id and l.user_id = auth.uid()));
drop policy if exists owner_insert_future_letter_rules on public.future_letter_rules;
create policy owner_insert_future_letter_rules on public.future_letter_rules for insert to authenticated with check (exists (select 1 from public.future_letter_rule_groups g join public.future_letters l on l.id = g.letter_id where g.id = group_id and l.user_id = auth.uid()));
drop policy if exists owner_update_future_letter_rules on public.future_letter_rules;
create policy owner_update_future_letter_rules on public.future_letter_rules for update to authenticated using (exists (select 1 from public.future_letter_rule_groups g join public.future_letters l on l.id = g.letter_id where g.id = group_id and l.user_id = auth.uid())) with check (exists (select 1 from public.future_letter_rule_groups g join public.future_letters l on l.id = g.letter_id where g.id = group_id and l.user_id = auth.uid()));
drop policy if exists owner_delete_future_letter_rules on public.future_letter_rules;
create policy owner_delete_future_letter_rules on public.future_letter_rules for delete to authenticated using (exists (select 1 from public.future_letter_rule_groups g join public.future_letters l on l.id = g.letter_id where g.id = group_id and l.user_id = auth.uid()));

drop policy if exists owner_select_future_letter_trigger_events on public.future_letter_trigger_events;
create policy owner_select_future_letter_trigger_events on public.future_letter_trigger_events for select to authenticated using (exists (select 1 from public.future_letters l where l.id = letter_id and l.user_id = auth.uid()));
drop policy if exists owner_insert_future_letter_trigger_events on public.future_letter_trigger_events;
create policy owner_insert_future_letter_trigger_events on public.future_letter_trigger_events for insert to authenticated with check (exists (select 1 from public.future_letters l where l.id = letter_id and l.user_id = auth.uid()));
drop policy if exists owner_update_future_letter_trigger_events on public.future_letter_trigger_events;
create policy owner_update_future_letter_trigger_events on public.future_letter_trigger_events for update to authenticated using (exists (select 1 from public.future_letters l where l.id = letter_id and l.user_id = auth.uid())) with check (exists (select 1 from public.future_letters l where l.id = letter_id and l.user_id = auth.uid()));
drop policy if exists owner_delete_future_letter_trigger_events on public.future_letter_trigger_events;
create policy owner_delete_future_letter_trigger_events on public.future_letter_trigger_events for delete to authenticated using (exists (select 1 from public.future_letters l where l.id = letter_id and l.user_id = auth.uid()));

drop policy if exists owner_select_future_letter_random_rolls on public.future_letter_random_rolls;
create policy owner_select_future_letter_random_rolls on public.future_letter_random_rolls for select to authenticated using (auth.uid() = user_id);
drop policy if exists owner_insert_future_letter_random_rolls on public.future_letter_random_rolls;
create policy owner_insert_future_letter_random_rolls on public.future_letter_random_rolls for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists owner_update_future_letter_random_rolls on public.future_letter_random_rolls;
create policy owner_update_future_letter_random_rolls on public.future_letter_random_rolls for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists owner_delete_future_letter_random_rolls on public.future_letter_random_rolls;
create policy owner_delete_future_letter_random_rolls on public.future_letter_random_rolls for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.future_letters, public.future_letter_context_attachments, public.future_letter_rule_groups, public.future_letter_rules, public.future_letter_trigger_events, public.future_letter_random_rolls to authenticated;

commit;

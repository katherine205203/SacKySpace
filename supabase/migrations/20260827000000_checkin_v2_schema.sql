begin;

create extension if not exists pgcrypto;

create table if not exists public.emotion_families (
  emotion_family_id text primary key,
  family_code text not null unique,
  family_name_vn text not null,
  family_name_en text not null,
  color_hex text not null,
  active boolean not null default true,
  sort_order integer not null
);

create table if not exists public.emotions (
  emotion_id text primary key,
  emotion_family_id text not null references public.emotion_families(emotion_family_id),
  emotion_name_vn text not null,
  emotion_name_en text not null,
  emoji text not null,
  color_hex text not null,
  description_vn text not null,
  description_en text not null,
  active boolean not null default true,
  sort_order integer not null
);

create table if not exists public.need_groups (
  need_group_id text primary key,
  group_code text not null unique,
  group_name_vn text not null,
  group_name_en text not null,
  color_hex text not null,
  active boolean not null default true,
  sort_order integer not null
);

create table if not exists public.needs (
  need_id text primary key,
  need_group_id text not null references public.need_groups(need_group_id),
  need_name_vn text not null,
  need_name_en text not null,
  emoji text not null,
  color_hex text not null,
  description_vn text not null,
  description_en text not null,
  active boolean not null default true,
  sort_order integer not null
);

create table if not exists public.contexts (
  context_id text primary key,
  context_group text not null,
  context_name_vn text not null,
  emoji text not null,
  color_hex text not null,
  description_vn text not null,
  active boolean not null default true,
  sort_order integer not null
);

create table if not exists public.unknown_prompts (
  prompt_id text primary key,
  emoji text not null,
  prompt_text_vn text not null,
  active boolean not null default true,
  sort_order integer not null
);

create table if not exists public.care_actions (
  care_action_id text primary key,
  care_group text not null,
  emoji text not null,
  title_vn text not null,
  description_vn text not null,
  duration_min integer null check (duration_min is null or duration_min > 0),
  active boolean not null default true,
  sort_order integer not null
);

create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  checkin_type text not null check (checkin_type in ('emotion', 'unknown')),
  primary_emotion_id text null references public.emotions(emotion_id),
  intensity smallint null check (intensity between 1 and 5),
  note text null,
  unknown_prompt_id text null references public.unknown_prompts(prompt_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint checkins_payload_valid check (
    (
      checkin_type = 'emotion'
      and primary_emotion_id is not null
      and intensity is not null
    )
    or (
      checkin_type = 'unknown'
      and primary_emotion_id is null
      and intensity is null
      and unknown_prompt_id is not null
      and btrim(coalesce(note, '')) <> ''
    )
  )
);

create table if not exists public.checkin_secondary_emotions (
  checkin_id uuid not null references public.checkins(id) on delete cascade,
  emotion_id text not null references public.emotions(emotion_id),
  position smallint not null check (position > 0),
  primary key (checkin_id, emotion_id)
);

create table if not exists public.checkin_needs (
  checkin_id uuid not null references public.checkins(id) on delete cascade,
  need_id text not null references public.needs(need_id),
  position smallint not null check (position > 0),
  primary key (checkin_id, need_id)
);

create table if not exists public.checkin_contexts (
  checkin_id uuid not null references public.checkins(id) on delete cascade,
  context_id text not null references public.contexts(context_id),
  position smallint not null check (position > 0),
  primary key (checkin_id, context_id)
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  origin text not null default 'checkin',
  source_checkin_id uuid null references public.checkins(id) on delete cascade,
  care_action_id text null references public.care_actions(care_action_id),
  title text not null,
  note text null,
  planned_date date null,
  due_time time null,
  status text not null default 'pending',
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reminders_origin_valid check (
    origin <> 'checkin' or source_checkin_id is not null
  )
);

create index if not exists emotions_family_sort_idx
  on public.emotions (emotion_family_id, sort_order);
create index if not exists needs_group_sort_idx
  on public.needs (need_group_id, sort_order);
create index if not exists contexts_group_sort_idx
  on public.contexts (context_group, sort_order);
create index if not exists checkins_user_created_idx
  on public.checkins (user_id, created_at desc);
create index if not exists reminders_source_checkin_idx
  on public.reminders (source_checkin_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_checkin_created_at_update()
returns trigger
language plpgsql
as $$
begin
  if new.created_at is distinct from old.created_at then
    raise exception 'checkins.created_at is immutable';
  end if;
  return new;
end;
$$;

create or replace function public.validate_checkin_payload()
returns trigger
language plpgsql
as $$
begin
  if new.checkin_type = 'emotion'
     and (new.primary_emotion_id is null or new.intensity is null) then
    raise exception 'Emotion check-ins require a primary emotion and intensity';
  end if;

  if new.checkin_type = 'unknown'
     and (new.unknown_prompt_id is null or btrim(coalesce(new.note, '')) = '') then
    raise exception 'Unknown check-ins require a prompt and a nonblank note';
  end if;

  return new;
end;
$$;

create or replace function public.validate_secondary_emotion_limit()
returns trigger
language plpgsql
as $$
declare
  primary_emotion text;
  relation_count integer;
begin
  select primary_emotion_id
    into primary_emotion
    from public.checkins
   where id = new.checkin_id;

  if primary_emotion = new.emotion_id then
    raise exception 'Primary emotion cannot also be a secondary emotion';
  end if;

  select count(*)
    into relation_count
    from public.checkin_secondary_emotions
   where checkin_id = new.checkin_id
     and not (
       tg_op = 'UPDATE'
       and checkin_id = old.checkin_id
       and emotion_id = old.emotion_id
     );

  if relation_count >= 2 then
    raise exception 'A check-in can have at most 2 secondary emotions';
  end if;

  return new;
end;
$$;

create or replace function public.validate_need_limit()
returns trigger
language plpgsql
as $$
declare
  relation_count integer;
begin
  select count(*)
    into relation_count
    from public.checkin_needs
   where checkin_id = new.checkin_id
     and not (
       tg_op = 'UPDATE'
       and checkin_id = old.checkin_id
       and need_id = old.need_id
     );

  if relation_count >= 3 then
    raise exception 'A check-in can have at most 3 needs';
  end if;

  return new;
end;
$$;

create or replace function public.validate_context_limit()
returns trigger
language plpgsql
as $$
declare
  relation_count integer;
begin
  select count(*)
    into relation_count
    from public.checkin_contexts
   where checkin_id = new.checkin_id
     and not (
       tg_op = 'UPDATE'
       and checkin_id = old.checkin_id
       and context_id = old.context_id
     );

  if relation_count >= 2 then
    raise exception 'A check-in can have at most 2 contexts';
  end if;

  return new;
end;
$$;

create or replace function public.validate_checkin_reminder_limit()
returns trigger
language plpgsql
as $$
declare
  relation_count integer;
begin
  if new.origin = 'checkin' and new.source_checkin_id is not null then
    select count(*)
      into relation_count
      from public.reminders
     where source_checkin_id = new.source_checkin_id
       and origin = 'checkin'
       and not (
         tg_op = 'UPDATE'
         and id = old.id
       );

    if relation_count >= 2 then
      raise exception 'A check-in can have at most 2 linked actions';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists checkins_set_updated_at on public.checkins;
create trigger checkins_set_updated_at
before update on public.checkins
for each row execute function public.set_updated_at();

drop trigger if exists checkins_created_at_immutable on public.checkins;
create trigger checkins_created_at_immutable
before update on public.checkins
for each row execute function public.prevent_checkin_created_at_update();

drop trigger if exists checkins_payload_validation on public.checkins;
create trigger checkins_payload_validation
before insert or update on public.checkins
for each row execute function public.validate_checkin_payload();

drop trigger if exists reminders_set_updated_at on public.reminders;
create trigger reminders_set_updated_at
before update on public.reminders
for each row execute function public.set_updated_at();

drop trigger if exists secondary_emotion_limit on public.checkin_secondary_emotions;
create trigger secondary_emotion_limit
before insert or update on public.checkin_secondary_emotions
for each row execute function public.validate_secondary_emotion_limit();

drop trigger if exists need_limit on public.checkin_needs;
create trigger need_limit
before insert or update on public.checkin_needs
for each row execute function public.validate_need_limit();

drop trigger if exists context_limit on public.checkin_contexts;
create trigger context_limit
before insert or update on public.checkin_contexts
for each row execute function public.validate_context_limit();

drop trigger if exists checkin_reminder_limit on public.reminders;
create trigger checkin_reminder_limit
before insert or update on public.reminders
for each row execute function public.validate_checkin_reminder_limit();

alter table public.emotion_families enable row level security;
alter table public.emotions enable row level security;
alter table public.need_groups enable row level security;
alter table public.needs enable row level security;
alter table public.contexts enable row level security;
alter table public.unknown_prompts enable row level security;
alter table public.care_actions enable row level security;
alter table public.checkins enable row level security;
alter table public.checkin_secondary_emotions enable row level security;
alter table public.checkin_needs enable row level security;
alter table public.checkin_contexts enable row level security;
alter table public.reminders enable row level security;

drop policy if exists authenticated_read_emotion_families on public.emotion_families;
create policy authenticated_read_emotion_families
  on public.emotion_families for select to authenticated using (true);
drop policy if exists authenticated_read_emotions on public.emotions;
create policy authenticated_read_emotions
  on public.emotions for select to authenticated using (true);
drop policy if exists authenticated_read_need_groups on public.need_groups;
create policy authenticated_read_need_groups
  on public.need_groups for select to authenticated using (true);
drop policy if exists authenticated_read_needs on public.needs;
create policy authenticated_read_needs
  on public.needs for select to authenticated using (true);
drop policy if exists authenticated_read_contexts on public.contexts;
create policy authenticated_read_contexts
  on public.contexts for select to authenticated using (true);
drop policy if exists authenticated_read_unknown_prompts on public.unknown_prompts;
create policy authenticated_read_unknown_prompts
  on public.unknown_prompts for select to authenticated using (true);
drop policy if exists authenticated_read_care_actions on public.care_actions;
create policy authenticated_read_care_actions
  on public.care_actions for select to authenticated using (true);

drop policy if exists owner_select_checkins on public.checkins;
create policy owner_select_checkins
  on public.checkins for select to authenticated using (auth.uid() = user_id);
drop policy if exists owner_insert_checkins on public.checkins;
create policy owner_insert_checkins
  on public.checkins for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists owner_update_checkins on public.checkins;
create policy owner_update_checkins
  on public.checkins for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists owner_delete_checkins on public.checkins;
create policy owner_delete_checkins
  on public.checkins for delete to authenticated using (auth.uid() = user_id);

drop policy if exists owner_select_secondary_emotions on public.checkin_secondary_emotions;
create policy owner_select_secondary_emotions
  on public.checkin_secondary_emotions for select to authenticated
  using (exists (select 1 from public.checkins c where c.id = checkin_id and c.user_id = auth.uid()));
drop policy if exists owner_insert_secondary_emotions on public.checkin_secondary_emotions;
create policy owner_insert_secondary_emotions
  on public.checkin_secondary_emotions for insert to authenticated
  with check (exists (select 1 from public.checkins c where c.id = checkin_id and c.user_id = auth.uid()));
drop policy if exists owner_update_secondary_emotions on public.checkin_secondary_emotions;
create policy owner_update_secondary_emotions
  on public.checkin_secondary_emotions for update to authenticated
  using (exists (select 1 from public.checkins c where c.id = checkin_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.checkins c where c.id = checkin_id and c.user_id = auth.uid()));
drop policy if exists owner_delete_secondary_emotions on public.checkin_secondary_emotions;
create policy owner_delete_secondary_emotions
  on public.checkin_secondary_emotions for delete to authenticated
  using (exists (select 1 from public.checkins c where c.id = checkin_id and c.user_id = auth.uid()));

drop policy if exists owner_select_needs on public.checkin_needs;
create policy owner_select_needs
  on public.checkin_needs for select to authenticated
  using (exists (select 1 from public.checkins c where c.id = checkin_id and c.user_id = auth.uid()));
drop policy if exists owner_insert_needs on public.checkin_needs;
create policy owner_insert_needs
  on public.checkin_needs for insert to authenticated
  with check (exists (select 1 from public.checkins c where c.id = checkin_id and c.user_id = auth.uid()));
drop policy if exists owner_update_needs on public.checkin_needs;
create policy owner_update_needs
  on public.checkin_needs for update to authenticated
  using (exists (select 1 from public.checkins c where c.id = checkin_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.checkins c where c.id = checkin_id and c.user_id = auth.uid()));
drop policy if exists owner_delete_needs on public.checkin_needs;
create policy owner_delete_needs
  on public.checkin_needs for delete to authenticated
  using (exists (select 1 from public.checkins c where c.id = checkin_id and c.user_id = auth.uid()));

drop policy if exists owner_select_contexts on public.checkin_contexts;
create policy owner_select_contexts
  on public.checkin_contexts for select to authenticated
  using (exists (select 1 from public.checkins c where c.id = checkin_id and c.user_id = auth.uid()));
drop policy if exists owner_insert_contexts on public.checkin_contexts;
create policy owner_insert_contexts
  on public.checkin_contexts for insert to authenticated
  with check (exists (select 1 from public.checkins c where c.id = checkin_id and c.user_id = auth.uid()));
drop policy if exists owner_update_contexts on public.checkin_contexts;
create policy owner_update_contexts
  on public.checkin_contexts for update to authenticated
  using (exists (select 1 from public.checkins c where c.id = checkin_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.checkins c where c.id = checkin_id and c.user_id = auth.uid()));
drop policy if exists owner_delete_contexts on public.checkin_contexts;
create policy owner_delete_contexts
  on public.checkin_contexts for delete to authenticated
  using (exists (select 1 from public.checkins c where c.id = checkin_id and c.user_id = auth.uid()));

drop policy if exists owner_select_reminders on public.reminders;
create policy owner_select_reminders
  on public.reminders for select to authenticated using (auth.uid() = user_id);
drop policy if exists owner_insert_reminders on public.reminders;
create policy owner_insert_reminders
  on public.reminders for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists owner_update_reminders on public.reminders;
create policy owner_update_reminders
  on public.reminders for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists owner_delete_reminders on public.reminders;
create policy owner_delete_reminders
  on public.reminders for delete to authenticated using (auth.uid() = user_id);

grant select on public.emotion_families, public.emotions, public.need_groups,
  public.needs, public.contexts, public.unknown_prompts, public.care_actions to authenticated;
grant select, insert, update, delete on public.checkins, public.checkin_secondary_emotions,
  public.checkin_needs, public.checkin_contexts, public.reminders to authenticated;

commit;

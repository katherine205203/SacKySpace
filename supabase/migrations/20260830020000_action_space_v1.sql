begin;

-- Action Space v1 is an additive semantic layer over the existing reminders table.
-- Existing rows remain valid Actions and keep their current ids/origin values.

alter table public.reminders
  add column if not exists planned_end_date date null;

-- An Action may keep its immutable origin after its current Check-in link is removed.
alter table public.reminders
  drop constraint if exists reminders_origin_valid;

alter table public.reminders
  drop constraint if exists reminders_source_checkin_id_fkey;
alter table public.reminders
  add constraint reminders_source_checkin_id_fkey
  foreign key (source_checkin_id) references public.checkins(id) on delete set null;

-- Only active linked Actions count toward the Check-in limit.
create or replace function public.validate_checkin_reminder_limit()
returns trigger
language plpgsql
as $$
declare
  relation_count integer;
begin
  if new.source_checkin_id is not null and new.status <> 'completed' then
    select count(*)
      into relation_count
      from public.reminders
     where source_checkin_id = new.source_checkin_id
       and status <> 'completed'
       and not (tg_op = 'UPDATE' and id = old.id);

    if relation_count >= 2 then
      raise exception 'A check-in can have at most 2 linked actions';
    end if;
  end if;
  return new;
end;
$$;

create table if not exists public.action_reflection_outcomes (
  id text primary key,
  label_vn text not null,
  semantic_group text not null check (semantic_group in ('positive', 'neutral', 'negative', 'other')),
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.action_reflection_outcomes (id, label_vn, semantic_group, sort_order)
values
  ('better', 'Ổn hơn', 'positive', 1),
  ('lighter', 'Nhẹ hơn một chút', 'positive', 2),
  ('same', 'Không khác mấy', 'neutral', 3),
  ('not_better', 'Chưa ổn hơn', 'negative', 4),
  ('other', 'Khác', 'other', 5)
on conflict (id) do nothing;

create table if not exists public.action_completion_cycles (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.reminders(id) on delete cascade,
  cycle_number integer not null check (cycle_number > 0),
  completed_at timestamptz not null default now(),
  reopened_at timestamptz null,
  created_at timestamptz not null default now(),
  unique (action_id, cycle_number)
);

create table if not exists public.action_reflections (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.reminders(id) on delete cascade,
  completion_cycle_id uuid not null references public.action_completion_cycles(id) on delete cascade,
  outcome_id text not null references public.action_reflection_outcomes(id),
  outcome_snapshot text null,
  note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists action_completion_cycles_action_idx
  on public.action_completion_cycles (action_id, cycle_number desc);
create index if not exists action_reflections_action_idx
  on public.action_reflections (action_id, created_at desc);
create unique index if not exists action_reflections_cycle_unique_idx
  on public.action_reflections (completion_cycle_id);

drop trigger if exists action_reflections_set_updated_at on public.action_reflections;
create trigger action_reflections_set_updated_at
before update on public.action_reflections
for each row execute function public.set_updated_at();

alter table public.action_reflection_outcomes enable row level security;
alter table public.action_completion_cycles enable row level security;
alter table public.action_reflections enable row level security;

drop policy if exists authenticated_read_action_reflection_outcomes on public.action_reflection_outcomes;
create policy authenticated_read_action_reflection_outcomes
  on public.action_reflection_outcomes for select to authenticated using (true);

drop policy if exists owner_select_action_completion_cycles on public.action_completion_cycles;
create policy owner_select_action_completion_cycles
  on public.action_completion_cycles for select to authenticated
  using (exists (select 1 from public.reminders r where r.id = action_id and r.user_id = auth.uid()));
drop policy if exists owner_insert_action_completion_cycles on public.action_completion_cycles;
create policy owner_insert_action_completion_cycles
  on public.action_completion_cycles for insert to authenticated
  with check (exists (select 1 from public.reminders r where r.id = action_id and r.user_id = auth.uid()));
drop policy if exists owner_update_action_completion_cycles on public.action_completion_cycles;
create policy owner_update_action_completion_cycles
  on public.action_completion_cycles for update to authenticated
  using (exists (select 1 from public.reminders r where r.id = action_id and r.user_id = auth.uid()));
drop policy if exists owner_delete_action_completion_cycles on public.action_completion_cycles;
create policy owner_delete_action_completion_cycles
  on public.action_completion_cycles for delete to authenticated
  using (exists (select 1 from public.reminders r where r.id = action_id and r.user_id = auth.uid()));

drop policy if exists owner_select_action_reflections on public.action_reflections;
create policy owner_select_action_reflections
  on public.action_reflections for select to authenticated
  using (exists (select 1 from public.reminders r where r.id = action_id and r.user_id = auth.uid()));
drop policy if exists owner_insert_action_reflections on public.action_reflections;
create policy owner_insert_action_reflections
  on public.action_reflections for insert to authenticated
  with check (exists (select 1 from public.reminders r where r.id = action_id and r.user_id = auth.uid()));
drop policy if exists owner_update_action_reflections on public.action_reflections;
create policy owner_update_action_reflections
  on public.action_reflections for update to authenticated
  using (exists (select 1 from public.reminders r where r.id = action_id and r.user_id = auth.uid()));
drop policy if exists owner_delete_action_reflections on public.action_reflections;
create policy owner_delete_action_reflections
  on public.action_reflections for delete to authenticated
  using (exists (select 1 from public.reminders r where r.id = action_id and r.user_id = auth.uid()));

grant select on public.action_reflection_outcomes to authenticated;
grant select, insert, update, delete on public.action_completion_cycles, public.action_reflections to authenticated;

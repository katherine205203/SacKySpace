begin;

alter table public.diary_entries
  add column if not exists day_locked_at timestamptz null;

update public.diary_entries
set status = 'user_done'
where status = 'done';

alter table public.diary_entries
  drop constraint if exists diary_entries_status_check;

alter table public.diary_entries
  add constraint diary_entries_status_check
  check (status in ('draft', 'user_done', 'day_locked', 'deleted'));

create table if not exists public.diary_day_record_snapshots (
  diary_id uuid not null references public.diary_entries(id) on delete cascade,
  source_type text not null check (source_type in ('checkin', 'action')),
  source_id uuid not null,
  occurred_at timestamptz not null,
  payload jsonb not null,
  locked_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (diary_id, source_type, source_id)
);

create index if not exists diary_day_record_snapshots_diary_idx
  on public.diary_day_record_snapshots (diary_id, occurred_at);

alter table public.diary_day_record_snapshots enable row level security;

drop policy if exists owner_select_diary_day_record_snapshots on public.diary_day_record_snapshots;
create policy owner_select_diary_day_record_snapshots
  on public.diary_day_record_snapshots for select to authenticated
  using (exists (select 1 from public.diary_entries d where d.id = diary_id and d.user_id = auth.uid()));

drop policy if exists owner_insert_diary_day_record_snapshots on public.diary_day_record_snapshots;
create policy owner_insert_diary_day_record_snapshots
  on public.diary_day_record_snapshots for insert to authenticated
  with check (exists (select 1 from public.diary_entries d where d.id = diary_id and d.user_id = auth.uid()));

drop policy if exists owner_update_diary_day_record_snapshots on public.diary_day_record_snapshots;
create policy owner_update_diary_day_record_snapshots
  on public.diary_day_record_snapshots for update to authenticated
  using (exists (select 1 from public.diary_entries d where d.id = diary_id and d.user_id = auth.uid()))
  with check (exists (select 1 from public.diary_entries d where d.id = diary_id and d.user_id = auth.uid()));

grant select, insert, update on public.diary_day_record_snapshots to authenticated;

commit;

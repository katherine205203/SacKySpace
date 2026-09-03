begin;

create table if not exists public.journey_diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'done')),
  range_start date not null,
  range_end date not null,
  title text not null check (btrim(title) <> ''),
  overall_text text not null check (btrim(overall_text) <> ''),
  primary_emotion_id text null references public.emotions(emotion_id),
  primary_emotion_snapshot jsonb null,
  closing_thought text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null,
  check (range_start <= range_end)
);

create table if not exists public.journey_daily_diary_links (
  journey_id uuid not null references public.journey_diary_entries(id) on delete cascade,
  diary_id uuid not null references public.diary_entries(id) on delete cascade,
  position smallint not null check (position > 0),
  created_at timestamptz not null default now(),
  primary key (journey_id, diary_id),
  unique (journey_id, position)
);

create table if not exists public.journey_checkin_links (
  journey_id uuid not null references public.journey_diary_entries(id) on delete cascade,
  checkin_id uuid not null references public.checkins(id) on delete cascade,
  weight_percent smallint not null check (weight_percent between 1 and 100),
  position smallint not null check (position > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (journey_id, checkin_id),
  unique (journey_id, position)
);

create or replace function public.validate_journey_attachment_range()
returns trigger
language plpgsql
as $$
declare
  journey_start date;
  journey_end date;
  item_day date;
begin
  select range_start, range_end into journey_start, journey_end
  from public.journey_diary_entries where id = new.journey_id;
  if journey_start is null or journey_end is null then
    raise exception 'Journey Diary does not exist';
  end if;
  if tg_table_name = 'journey_daily_diary_links' then
    select local_date into item_day from public.diary_entries where id = new.diary_id;
  else
    select (created_at at time zone 'Asia/Ho_Chi_Minh')::date into item_day
    from public.checkins where id = new.checkin_id;
  end if;
  if item_day is null or item_day < journey_start or item_day > journey_end then
    raise exception 'Journey attachments must be inside the selected timeframe';
  end if;
  return new;
end;
$$;

drop trigger if exists journey_entries_set_updated_at on public.journey_diary_entries;
create trigger journey_entries_set_updated_at before update on public.journey_diary_entries for each row execute function public.set_updated_at();
drop trigger if exists journey_checkin_links_set_updated_at on public.journey_checkin_links;
create trigger journey_checkin_links_set_updated_at before update on public.journey_checkin_links for each row execute function public.set_updated_at();
drop trigger if exists journey_daily_attachment_range on public.journey_daily_diary_links;
create trigger journey_daily_attachment_range before insert or update on public.journey_daily_diary_links for each row execute function public.validate_journey_attachment_range();
drop trigger if exists journey_checkin_attachment_range on public.journey_checkin_links;
create trigger journey_checkin_attachment_range before insert or update on public.journey_checkin_links for each row execute function public.validate_journey_attachment_range();

create index if not exists journey_entries_user_range_idx on public.journey_diary_entries (user_id, range_end desc, updated_at desc);
create index if not exists journey_daily_links_diary_idx on public.journey_daily_diary_links (diary_id);
create index if not exists journey_checkin_links_checkin_idx on public.journey_checkin_links (checkin_id);

alter table public.journey_diary_entries enable row level security;
alter table public.journey_daily_diary_links enable row level security;
alter table public.journey_checkin_links enable row level security;

drop policy if exists owner_select_journey_entries on public.journey_diary_entries;
create policy owner_select_journey_entries on public.journey_diary_entries for select to authenticated using (auth.uid() = user_id);
drop policy if exists owner_insert_journey_entries on public.journey_diary_entries;
create policy owner_insert_journey_entries on public.journey_diary_entries for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists owner_update_journey_entries on public.journey_diary_entries;
create policy owner_update_journey_entries on public.journey_diary_entries for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists owner_delete_journey_entries on public.journey_diary_entries;
create policy owner_delete_journey_entries on public.journey_diary_entries for delete to authenticated using (auth.uid() = user_id);

drop policy if exists owner_select_journey_daily_links on public.journey_daily_diary_links;
create policy owner_select_journey_daily_links on public.journey_daily_diary_links for select to authenticated using (exists (select 1 from public.journey_diary_entries j where j.id = journey_id and j.user_id = auth.uid()));
drop policy if exists owner_insert_journey_daily_links on public.journey_daily_diary_links;
create policy owner_insert_journey_daily_links on public.journey_daily_diary_links for insert to authenticated with check (exists (select 1 from public.journey_diary_entries j join public.diary_entries d on d.id = diary_id where j.id = journey_id and j.user_id = auth.uid() and d.user_id = auth.uid()));
drop policy if exists owner_delete_journey_daily_links on public.journey_daily_diary_links;
create policy owner_delete_journey_daily_links on public.journey_daily_diary_links for delete to authenticated using (exists (select 1 from public.journey_diary_entries j where j.id = journey_id and j.user_id = auth.uid()));

drop policy if exists owner_select_journey_checkin_links on public.journey_checkin_links;
create policy owner_select_journey_checkin_links on public.journey_checkin_links for select to authenticated using (exists (select 1 from public.journey_diary_entries j where j.id = journey_id and j.user_id = auth.uid()));
drop policy if exists owner_insert_journey_checkin_links on public.journey_checkin_links;
create policy owner_insert_journey_checkin_links on public.journey_checkin_links for insert to authenticated with check (exists (select 1 from public.journey_diary_entries j join public.checkins c on c.id = checkin_id where j.id = journey_id and j.user_id = auth.uid() and c.user_id = auth.uid()));
drop policy if exists owner_update_journey_checkin_links on public.journey_checkin_links;
create policy owner_update_journey_checkin_links on public.journey_checkin_links for update to authenticated using (exists (select 1 from public.journey_diary_entries j where j.id = journey_id and j.user_id = auth.uid())) with check (exists (select 1 from public.journey_diary_entries j where j.id = journey_id and j.user_id = auth.uid()));
drop policy if exists owner_delete_journey_checkin_links on public.journey_checkin_links;
create policy owner_delete_journey_checkin_links on public.journey_checkin_links for delete to authenticated using (exists (select 1 from public.journey_diary_entries j where j.id = journey_id and j.user_id = auth.uid()));

grant select, insert, update, delete on public.journey_diary_entries to authenticated;
grant select, insert, delete on public.journey_daily_diary_links to authenticated;
grant select, insert, update, delete on public.journey_checkin_links to authenticated;

commit;

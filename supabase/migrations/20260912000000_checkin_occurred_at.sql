begin;

alter table public.checkins
  add column if not exists occurred_at timestamptz;

update public.checkins
set occurred_at = created_at
where occurred_at is null;

alter table public.checkins
  alter column occurred_at set default now(),
  alter column occurred_at set not null;

create index if not exists checkins_user_occurred_idx
  on public.checkins (user_id, occurred_at desc);

create or replace function public.validate_checkin_occurred_at()
returns trigger
language plpgsql
as $$
begin
  if new.occurred_at > now() then
    raise exception 'checkins.occurred_at cannot be in the future';
  end if;
  return new;
end;
$$;

drop trigger if exists checkins_occurred_at_not_future on public.checkins;
create trigger checkins_occurred_at_not_future
before insert or update on public.checkins
for each row execute function public.validate_checkin_occurred_at();

create or replace function public.validate_diary_checkin_date()
returns trigger
language plpgsql
as $$
declare
  diary_day date;
  checkin_day date;
begin
  select local_date into diary_day
    from public.diary_entries
   where id = new.diary_id;

  select (occurred_at at time zone 'Asia/Ho_Chi_Minh')::date into checkin_day
    from public.checkins
   where id = new.checkin_id;

  if diary_day is null or checkin_day is null or diary_day <> checkin_day then
    raise exception 'Diary attachments must use Check-ins from the same local date';
  end if;
  return new;
end;
$$;

create or replace function public.sync_checkin_diary_attachments()
returns trigger
language plpgsql
as $$
declare
  previous_day date;
  next_day date;
  created_day date;
  target_diary_id uuid;
  attachment_weight smallint;
  attachment_position smallint;
  has_attachment boolean := false;
begin
  next_day := (new.occurred_at at time zone 'Asia/Ho_Chi_Minh')::date;
  created_day := (new.created_at at time zone 'Asia/Ho_Chi_Minh')::date;
  previous_day := case when tg_op = 'UPDATE' then (old.occurred_at at time zone 'Asia/Ho_Chi_Minh')::date else null end;

  if tg_op = 'UPDATE' and previous_day = next_day then
    return new;
  end if;
  if tg_op = 'INSERT' and created_day = next_day then
    return new;
  end if;

  insert into public.diary_entries (user_id, local_date, status, title, overall_text)
  values (new.user_id, next_day, 'draft', null, null)
  on conflict (user_id, local_date) do nothing;

  select id into target_diary_id
    from public.diary_entries
   where user_id = new.user_id
     and local_date = next_day;

  if target_diary_id is null then
    return new;
  end if;

  select weight_percent, position
    into attachment_weight, attachment_position
    from public.diary_checkin_links
   where checkin_id = new.id
   order by created_at
   limit 1;

  has_attachment := attachment_weight is not null;
  if not has_attachment then
    attachment_weight := 100;
  end if;

  if attachment_position is null
     or exists (
       select 1
         from public.diary_checkin_links
        where diary_id = target_diary_id
          and checkin_id <> new.id
          and position = attachment_position
     ) then
    select coalesce(max(position), 0) + 1
      into attachment_position
      from public.diary_checkin_links
     where diary_id = target_diary_id
       and checkin_id <> new.id;
  end if;

  insert into public.diary_checkin_links (diary_id, checkin_id, weight_percent, position)
  values (target_diary_id, new.id, attachment_weight, attachment_position)
  on conflict (diary_id, checkin_id) do update
    set weight_percent = excluded.weight_percent,
        position = excluded.position,
        updated_at = now();

  delete from public.diary_checkin_links
   where checkin_id = new.id
     and diary_id <> target_diary_id;

  return new;
end;
$$;

drop trigger if exists checkins_sync_diary_attachments on public.checkins;
create trigger checkins_sync_diary_attachments
after insert or update of occurred_at on public.checkins
for each row execute function public.sync_checkin_diary_attachments();

commit;

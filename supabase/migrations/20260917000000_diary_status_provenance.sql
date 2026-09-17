begin;

-- Diary lifecycle is now independent from Day Record's factual snapshot state.
alter table public.diary_entries
  add column if not exists completion_source text null,
  add column if not exists is_backfilled boolean not null default false;

alter table public.diary_entries
  drop constraint if exists diary_entries_status_check;

-- Preserve the meaning of historical records while moving the legacy lifecycle
-- values into the new status + provenance pair.
update public.diary_entries
set is_backfilled = true
where status <> 'deleted'
  and local_date < (created_at at time zone 'Asia/Ho_Chi_Minh')::date
  and is_backfilled = false;

update public.diary_entries
set status = 'done', completion_source = 'system'
where status = 'day_locked';

update public.diary_entries
set status = 'done', completion_source = 'user'
where status = 'user_done';

update public.diary_entries
set completion_source = 'user'
where status = 'done' and completion_source is null;

update public.diary_entries
set completion_source = null
where status in ('draft', 'deleted');

alter table public.diary_entries
  add constraint diary_entries_status_check
  check (status in ('draft', 'done', 'deleted'));

alter table public.diary_entries
  add constraint diary_entries_completion_source_check
  check (
    (status = 'done' and completion_source in ('user', 'system'))
    or (status in ('draft', 'deleted') and completion_source is null)
  );

create index if not exists diary_entries_lifecycle_idx
  on public.diary_entries (user_id, status, local_date desc);

-- Called whenever a user reads or saves Diary. It is intentionally scoped to
-- that user, so a stale draft cannot be finalized for somebody else.
create or replace function public.finalize_expired_diary_drafts()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  finalized_count integer;
begin
  update public.diary_entries
     set status = 'done',
         completion_source = 'system',
         completed_at = coalesce(completed_at, now()),
         updated_at = now()
   where user_id = auth.uid()
     and status = 'draft'
     and is_backfilled = false
     and local_date < (now() at time zone 'Asia/Ho_Chi_Minh')::date;

  get diagnostics finalized_count = row_count;
  return finalized_count;
end;
$$;

grant execute on function public.finalize_expired_diary_drafts() to authenticated;

-- Check-ins created with a historical occurred_at still need a Diary row for
-- attachment, but that row is a backfill draft and must remain editable.
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

  insert into public.diary_entries (user_id, local_date, status, title, overall_text, is_backfilled)
  values (
    new.user_id,
    next_day,
    'draft',
    null,
    null,
    next_day < (now() at time zone 'Asia/Ho_Chi_Minh')::date
  )
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

commit;

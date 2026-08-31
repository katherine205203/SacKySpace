begin;

create table if not exists public.gift_box_styles (
  id text primary key,
  name text not null,
  palette text[] not null,
  ribbon text not null,
  shape text not null check (shape in ('square', 'round', 'tall')),
  config jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  sort_order integer not null default 1
);

insert into public.gift_box_styles (id, name, palette, ribbon, shape, config, sort_order) values
  ('box-mint-coral', 'Mầm xanh & san hô', array['#56D6B1', '#FF806B'], '#FF806B', 'square', '{"seal":"✦"}', 1),
  ('box-sun-blue', 'Nắng vàng & xanh trời', array['#FFD15C', '#5C8DFF'], '#5C8DFF', 'round', '{"seal":"☼"}', 2),
  ('box-pink-orange', 'Hồng đào & cam ấm', array['#FF8FB3', '#FF9B54'], '#FF9B54', 'tall', '{"seal":"♡"}', 3),
  ('box-green-yellow', 'Lá non & vàng dịu', array['#75C96B', '#F4C95D'], '#75C96B', 'square', '{"seal":"❋"}', 4)
on conflict (id) do update set name = excluded.name, palette = excluded.palette, ribbon = excluded.ribbon, shape = excluded.shape, config = excluded.config, sort_order = excluded.sort_order;

create table if not exists public.gifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  creation_local_date date not null,
  type text not null default 'question' check (type in ('question', 'message')),
  status text not null default 'draft' check (status in ('draft', 'sent', 'delivered')),
  question_text text null,
  message_text text null,
  emotion_id text null references public.emotions(emotion_id),
  emotion_snapshot jsonb null,
  box_style_id text not null default 'box-mint-coral',
  box_style_snapshot jsonb null,
  sent_at timestamptz null,
  locked_at timestamptz null,
  deliver_at timestamptz null,
  delivered_at timestamptz null,
  opened_at timestamptz null,
  receipt_status text not null default 'pending' check (receipt_status in ('pending', 'received', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, creation_local_date)
);

create table if not exists public.gift_question_answers (
  gift_id uuid primary key references public.gifts(id) on delete cascade,
  answer_text text not null default '',
  is_done boolean not null default false,
  answered_at timestamptz null,
  updated_at timestamptz not null default now()
);

create table if not exists public.gift_diary_conversion_links (
  gift_id uuid primary key references public.gifts(id) on delete cascade,
  diary_id uuid not null references public.diary_entries(id) on delete cascade,
  diary_prompt_response_id text null,
  converted_at timestamptz not null default now()
);

create index if not exists gifts_user_date_idx on public.gifts (user_id, creation_local_date desc);
create index if not exists gifts_user_status_idx on public.gifts (user_id, status, delivered_at desc);

create or replace function public.gift_before_write()
returns trigger language plpgsql as $$
declare
  cutoff timestamptz;
begin
  if tg_op = 'INSERT' and new.creation_local_date <> (now() at time zone 'Asia/Ho_Chi_Minh')::date then
    raise exception 'Gift chỉ được tạo cho ngày hôm nay';
  end if;
  if tg_op = 'UPDATE' then
    cutoff := (old.creation_local_date::text || ' 23:30:00 Asia/Ho_Chi_Minh')::timestamptz;
    if new.user_id is distinct from old.user_id or new.creation_local_date is distinct from old.creation_local_date then
      raise exception 'Gift owner and creation date are immutable';
    end if;
    if old.status = 'draft' and (now() >= cutoff or old.creation_local_date <> (now() at time zone 'Asia/Ho_Chi_Minh')::date) then
      raise exception 'Bản nháp Gift đã hết hạn';
    end if;
    if old.status = 'sent' then
      if new.sent_at is distinct from old.sent_at or new.locked_at is distinct from old.locked_at or new.deliver_at is distinct from old.deliver_at then
        raise exception 'Lịch gửi của Gift đã được niêm phong';
      end if;
      if new.status is distinct from old.status and not (new.status = 'delivered' and old.deliver_at is not null and now() >= old.deliver_at) then
        raise exception 'Gift chỉ có thể chuyển sang delivered sau giờ giao';
      end if;
    end if;
    if old.status = 'sent' and old.locked_at is not null and now() >= old.locked_at then
      if new.status = 'delivered' and old.deliver_at is not null and now() >= old.deliver_at then
        if new.type is distinct from old.type or new.question_text is distinct from old.question_text or new.message_text is distinct from old.message_text or new.emotion_id is distinct from old.emotion_id or new.box_style_id is distinct from old.box_style_id or new.box_style_snapshot is distinct from old.box_style_snapshot or new.sent_at is distinct from old.sent_at or new.locked_at is distinct from old.locked_at or new.deliver_at is distinct from old.deliver_at then
          raise exception 'Gift đã khóa và không thể chỉnh sửa';
        end if;
      elsif new.status is distinct from old.status or new.type is distinct from old.type or new.question_text is distinct from old.question_text or new.message_text is distinct from old.message_text or new.emotion_id is distinct from old.emotion_id or new.box_style_id is distinct from old.box_style_id or new.box_style_snapshot is distinct from old.box_style_snapshot then
        raise exception 'Gift đã khóa và không thể chỉnh sửa';
      end if;
    elsif old.status = 'delivered' then
      if new.status is distinct from old.status or new.type is distinct from old.type or new.question_text is distinct from old.question_text or new.message_text is distinct from old.message_text or new.emotion_id is distinct from old.emotion_id or new.box_style_id is distinct from old.box_style_id or new.box_style_snapshot is distinct from old.box_style_snapshot or new.sent_at is distinct from old.sent_at or new.locked_at is distinct from old.locked_at or new.deliver_at is distinct from old.deliver_at or new.delivered_at is distinct from old.delivered_at then
        raise exception 'Gift đã đến và chỉ còn mở quà hoặc phản hồi';
      end if;
    end if;
  end if;
  if new.type = 'question' and new.status = 'sent' and coalesce(btrim(new.question_text), '') = '' then
    raise exception 'Câu hỏi không được để trống';
  end if;
  if new.type = 'message' and new.status = 'sent' and coalesce(btrim(new.message_text), '') = '' then
    raise exception 'Lời nhắn không được để trống';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists gifts_before_write on public.gifts;
create trigger gifts_before_write before insert or update on public.gifts for each row execute function public.gift_before_write();
drop trigger if exists gift_question_answers_set_updated_at on public.gift_question_answers;
create trigger gift_question_answers_set_updated_at before update on public.gift_question_answers for each row execute function public.set_updated_at();

create or replace function public.send_gift(
  p_gift_id uuid,
  p_question_text text,
  p_message_text text,
  p_emotion_id text,
  p_emotion_snapshot jsonb,
  p_box_style_id text,
  p_box_style_snapshot jsonb
)
returns public.gifts language plpgsql security invoker as $$
declare
  gift public.gifts;
  cutoff timestamptz;
  local_day date;
begin
  select * into gift from public.gifts where id = p_gift_id and user_id = auth.uid() for update;
  if gift.id is null then raise exception 'Không tìm thấy Gift'; end if;
  local_day := gift.creation_local_date;
  cutoff := (local_day::text || ' 23:30:00 Asia/Ho_Chi_Minh')::timestamptz;
  if now() >= cutoff then raise exception 'Đã quá 23:30, món quà này đã khóa'; end if;
  if gift.type = 'question' and coalesce(btrim(p_question_text), '') = '' then raise exception 'Câu hỏi không được để trống'; end if;
  if gift.type = 'message' and coalesce(btrim(p_message_text), '') = '' then raise exception 'Lời nhắn không được để trống'; end if;
  update public.gifts set status = 'sent', question_text = case when gift.type = 'question' then btrim(p_question_text) else null end, message_text = case when gift.type = 'message' then btrim(p_message_text) else null end, emotion_id = p_emotion_id, emotion_snapshot = p_emotion_snapshot, box_style_id = coalesce(p_box_style_id, gift.box_style_id), box_style_snapshot = p_box_style_snapshot, sent_at = coalesce(sent_at, now()), locked_at = cutoff, deliver_at = ((local_day + 1)::text || ' 03:00:00 Asia/Ho_Chi_Minh')::timestamptz where id = gift.id returning * into gift;
  return gift;
end;
$$;

create or replace function public.sync_gift_lifecycle()
returns void language plpgsql security invoker as $$
begin
  update public.gifts set status = 'delivered', delivered_at = coalesce(delivered_at, now()) where user_id = auth.uid() and status = 'sent' and deliver_at is not null and now() >= deliver_at;
  delete from public.gifts where user_id = auth.uid() and status = 'draft' and (creation_local_date < (now() at time zone 'Asia/Ho_Chi_Minh')::date or (creation_local_date = (now() at time zone 'Asia/Ho_Chi_Minh')::date and (now() at time zone 'Asia/Ho_Chi_Minh')::time >= time '23:30'));
end;
$$;

alter table public.gift_box_styles enable row level security;
alter table public.gifts enable row level security;
alter table public.gift_question_answers enable row level security;
alter table public.gift_diary_conversion_links enable row level security;

drop policy if exists gift_styles_read on public.gift_box_styles;
create policy gift_styles_read on public.gift_box_styles for select to authenticated using (active = true);
drop policy if exists gifts_owner_select on public.gifts;
create policy gifts_owner_select on public.gifts for select to authenticated using (auth.uid() = user_id);
drop policy if exists gifts_owner_insert on public.gifts;
create policy gifts_owner_insert on public.gifts for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists gifts_owner_update on public.gifts;
create policy gifts_owner_update on public.gifts for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists gifts_owner_delete_draft on public.gifts;
create policy gifts_owner_delete_draft on public.gifts for delete to authenticated using (auth.uid() = user_id and status = 'draft');
drop policy if exists gift_answers_owner_all on public.gift_question_answers;
create policy gift_answers_owner_all on public.gift_question_answers for all to authenticated using (exists (select 1 from public.gifts g where g.id = gift_id and g.user_id = auth.uid())) with check (exists (select 1 from public.gifts g where g.id = gift_id and g.user_id = auth.uid()));
drop policy if exists gift_conversion_owner_all on public.gift_diary_conversion_links;
create policy gift_conversion_owner_all on public.gift_diary_conversion_links for all to authenticated using (exists (select 1 from public.gifts g where g.id = gift_id and g.user_id = auth.uid())) with check (exists (select 1 from public.gifts g where g.id = gift_id and g.user_id = auth.uid()));

grant select on public.gift_box_styles to authenticated;
grant select, insert, update, delete on public.gifts to authenticated;
grant select, insert, update on public.gift_question_answers to authenticated;
grant select, insert, update on public.gift_diary_conversion_links to authenticated;
grant execute on function public.send_gift(uuid, text, text, text, jsonb, text, jsonb) to authenticated;
grant execute on function public.sync_gift_lifecycle() to authenticated;

commit;

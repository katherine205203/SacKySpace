begin;

create table if not exists public.diary_prompts (
  id text primary key,
  code text not null unique,
  text_vn text not null,
  text_en text null,
  emoji text not null,
  hex_color text not null,
  description text null,
  active boolean not null default true,
  sort_order integer not null
);

insert into public.diary_prompts (id, code, text_vn, emoji, hex_color, sort_order)
values
  ('DIARY_001', 'kind_today', 'Điều gì tử tế với bạn hôm nay?', '🌤️', '#F6BD60', 1),
  ('DIARY_002', 'small_joy', 'Một niềm vui nhỏ đã ở lại?', '✨', '#FFB703', 2),
  ('DIARY_003', 'learned', 'Bạn đã nhận ra điều gì mới?', '🌱', '#52B788', 3),
  ('DIARY_004', 'grateful', 'Hôm nay bạn biết ơn điều gì?', '💛', '#E9C46A', 4),
  ('DIARY_005', 'hard_part', 'Điều gì khó khăn nhưng đáng được gọi tên?', '🪨', '#9B5DE5', 5),
  ('DIARY_006', 'need', 'Phần nào trong bạn đang cần được chăm sóc?', '🫶', '#FF8FAB', 6),
  ('DIARY_007', 'connection', 'Ai hoặc điều gì đã kết nối với bạn?', '🔗', '#00A8E8', 7),
  ('DIARY_008', 'proud', 'Bạn muốn ghi nhận mình vì điều gì?', '🌟', '#FB8500', 8),
  ('DIARY_009', 'tomorrow', 'Bạn muốn mang theo điều gì vào ngày mai?', '🕯️', '#7B879D', 9)
on conflict (id) do update set
  code = excluded.code,
  text_vn = excluded.text_vn,
  emoji = excluded.emoji,
  hex_color = excluded.hex_color,
  sort_order = excluded.sort_order;

create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  status text not null default 'draft' check (status in ('draft', 'done', 'deleted')),
  title text not null check (btrim(title) <> ''),
  overall_text text not null check (btrim(overall_text) <> ''),
  daily_emotion_id text null references public.emotions(emotion_id),
  daily_emotion_snapshot jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null,
  deleted_at timestamptz null,
  unique (user_id, local_date)
);

create table if not exists public.diary_prompt_responses (
  diary_id uuid not null references public.diary_entries(id) on delete cascade,
  prompt_id text not null references public.diary_prompts(id),
  prompt_snapshot jsonb not null,
  position smallint not null check (position between 1 and 6),
  response_text text not null default '',
  is_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (diary_id, prompt_id),
  unique (diary_id, position)
);

create table if not exists public.diary_checkin_links (
  diary_id uuid not null references public.diary_entries(id) on delete cascade,
  checkin_id uuid not null references public.checkins(id) on delete cascade,
  weight_percent smallint not null check (weight_percent between 1 and 100),
  position smallint not null check (position > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (diary_id, checkin_id),
  unique (diary_id, position)
);

create table if not exists public.diary_images (
  id uuid primary key default gen_random_uuid(),
  diary_id uuid not null references public.diary_entries(id) on delete cascade,
  external_file_id text null,
  external_url text not null,
  position smallint not null check (position between 1 and 4),
  caption text null,
  metadata jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (diary_id, position)
);

create or replace function public.validate_diary_checkin_date()
returns trigger
language plpgsql
as $$
declare
  diary_day date;
  checkin_day date;
begin
  select local_date into diary_day from public.diary_entries where id = new.diary_id;
  select (created_at at time zone 'Asia/Ho_Chi_Minh')::date into checkin_day from public.checkins where id = new.checkin_id;
  if diary_day is null or checkin_day is null or diary_day <> checkin_day then
    raise exception 'Diary attachments must use Check-ins from the same local date';
  end if;
  return new;
end;
$$;

drop trigger if exists diary_entries_set_updated_at on public.diary_entries;
create trigger diary_entries_set_updated_at before update on public.diary_entries for each row execute function public.set_updated_at();
drop trigger if exists diary_prompt_responses_set_updated_at on public.diary_prompt_responses;
create trigger diary_prompt_responses_set_updated_at before update on public.diary_prompt_responses for each row execute function public.set_updated_at();
drop trigger if exists diary_checkin_links_set_updated_at on public.diary_checkin_links;
create trigger diary_checkin_links_set_updated_at before update on public.diary_checkin_links for each row execute function public.set_updated_at();
drop trigger if exists diary_images_set_updated_at on public.diary_images;
create trigger diary_images_set_updated_at before update on public.diary_images for each row execute function public.set_updated_at();
drop trigger if exists diary_checkin_same_day on public.diary_checkin_links;
create trigger diary_checkin_same_day before insert or update on public.diary_checkin_links for each row execute function public.validate_diary_checkin_date();

create index if not exists diary_entries_user_date_idx on public.diary_entries (user_id, local_date desc);
create index if not exists diary_checkin_links_checkin_idx on public.diary_checkin_links (checkin_id);

alter table public.diary_prompts enable row level security;
alter table public.diary_entries enable row level security;
alter table public.diary_prompt_responses enable row level security;
alter table public.diary_checkin_links enable row level security;
alter table public.diary_images enable row level security;

drop policy if exists authenticated_read_diary_prompts on public.diary_prompts;
create policy authenticated_read_diary_prompts on public.diary_prompts for select to authenticated using (true);

drop policy if exists owner_select_diary_entries on public.diary_entries;
create policy owner_select_diary_entries on public.diary_entries for select to authenticated using (auth.uid() = user_id);
drop policy if exists owner_insert_diary_entries on public.diary_entries;
create policy owner_insert_diary_entries on public.diary_entries for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists owner_update_diary_entries on public.diary_entries;
create policy owner_update_diary_entries on public.diary_entries for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists owner_delete_diary_entries on public.diary_entries;
create policy owner_delete_diary_entries on public.diary_entries for delete to authenticated using (auth.uid() = user_id);

drop policy if exists owner_select_diary_prompt_responses on public.diary_prompt_responses;
create policy owner_select_diary_prompt_responses on public.diary_prompt_responses for select to authenticated using (exists (select 1 from public.diary_entries d where d.id = diary_id and d.user_id = auth.uid()));
drop policy if exists owner_insert_diary_prompt_responses on public.diary_prompt_responses;
create policy owner_insert_diary_prompt_responses on public.diary_prompt_responses for insert to authenticated with check (exists (select 1 from public.diary_entries d where d.id = diary_id and d.user_id = auth.uid()));
drop policy if exists owner_update_diary_prompt_responses on public.diary_prompt_responses;
create policy owner_update_diary_prompt_responses on public.diary_prompt_responses for update to authenticated using (exists (select 1 from public.diary_entries d where d.id = diary_id and d.user_id = auth.uid())) with check (exists (select 1 from public.diary_entries d where d.id = diary_id and d.user_id = auth.uid()));
drop policy if exists owner_delete_diary_prompt_responses on public.diary_prompt_responses;
create policy owner_delete_diary_prompt_responses on public.diary_prompt_responses for delete to authenticated using (exists (select 1 from public.diary_entries d where d.id = diary_id and d.user_id = auth.uid()));

drop policy if exists owner_select_diary_checkin_links on public.diary_checkin_links;
create policy owner_select_diary_checkin_links on public.diary_checkin_links for select to authenticated using (exists (select 1 from public.diary_entries d where d.id = diary_id and d.user_id = auth.uid()));
drop policy if exists owner_insert_diary_checkin_links on public.diary_checkin_links;
create policy owner_insert_diary_checkin_links on public.diary_checkin_links for insert to authenticated with check (exists (select 1 from public.diary_entries d where d.id = diary_id and d.user_id = auth.uid()) and exists (select 1 from public.checkins c where c.id = checkin_id and c.user_id = auth.uid()));
drop policy if exists owner_update_diary_checkin_links on public.diary_checkin_links;
create policy owner_update_diary_checkin_links on public.diary_checkin_links for update to authenticated using (exists (select 1 from public.diary_entries d where d.id = diary_id and d.user_id = auth.uid())) with check (exists (select 1 from public.diary_entries d where d.id = diary_id and d.user_id = auth.uid()));
drop policy if exists owner_delete_diary_checkin_links on public.diary_checkin_links;
create policy owner_delete_diary_checkin_links on public.diary_checkin_links for delete to authenticated using (exists (select 1 from public.diary_entries d where d.id = diary_id and d.user_id = auth.uid()));

drop policy if exists owner_select_diary_images on public.diary_images;
create policy owner_select_diary_images on public.diary_images for select to authenticated using (exists (select 1 from public.diary_entries d where d.id = diary_id and d.user_id = auth.uid()));
drop policy if exists owner_insert_diary_images on public.diary_images;
create policy owner_insert_diary_images on public.diary_images for insert to authenticated with check (exists (select 1 from public.diary_entries d where d.id = diary_id and d.user_id = auth.uid()));
drop policy if exists owner_update_diary_images on public.diary_images;
create policy owner_update_diary_images on public.diary_images for update to authenticated using (exists (select 1 from public.diary_entries d where d.id = diary_id and d.user_id = auth.uid())) with check (exists (select 1 from public.diary_entries d where d.id = diary_id and d.user_id = auth.uid()));
drop policy if exists owner_delete_diary_images on public.diary_images;
create policy owner_delete_diary_images on public.diary_images for delete to authenticated using (exists (select 1 from public.diary_entries d where d.id = diary_id and d.user_id = auth.uid()));

grant select on public.diary_prompts to authenticated;
grant select, insert, update, delete on public.diary_entries, public.diary_prompt_responses, public.diary_checkin_links, public.diary_images to authenticated;

commit;

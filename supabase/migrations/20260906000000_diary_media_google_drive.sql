begin;

create table if not exists public.diary_media (
  id uuid primary key default gen_random_uuid(),
  diary_id uuid not null references public.diary_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  slot_order smallint not null check (slot_order between 1 and 4),
  source_type text not null check (source_type in ('local_upload', 'url_import')),
  drive_file_id text not null,
  media_key text not null unique,
  original_source_url text null,
  mime_type text not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  file_size_bytes bigint not null check (file_size_bytes > 0),
  upload_status text not null default 'saved' check (upload_status in ('saved', 'failed')),
  caption text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (diary_id, slot_order)
);

create index if not exists diary_media_user_idx on public.diary_media (user_id, created_at desc);
create index if not exists diary_media_diary_idx on public.diary_media (diary_id, slot_order);

drop trigger if exists diary_media_set_updated_at on public.diary_media;
create trigger diary_media_set_updated_at
before update on public.diary_media
for each row execute function public.set_updated_at();

alter table public.diary_media enable row level security;

drop policy if exists owner_select_diary_media on public.diary_media;
create policy owner_select_diary_media
on public.diary_media for select to authenticated
using (auth.uid() = user_id);

drop policy if exists owner_insert_diary_media on public.diary_media;
create policy owner_insert_diary_media
on public.diary_media for insert to authenticated
with check (auth.uid() = user_id and exists (
  select 1 from public.diary_entries d
  where d.id = diary_id and d.user_id = auth.uid()
));

drop policy if exists owner_update_diary_media on public.diary_media;
create policy owner_update_diary_media
on public.diary_media for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id and exists (
  select 1 from public.diary_entries d
  where d.id = diary_id and d.user_id = auth.uid()
));

drop policy if exists owner_delete_diary_media on public.diary_media;
create policy owner_delete_diary_media
on public.diary_media for delete to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on public.diary_media to authenticated;

commit;

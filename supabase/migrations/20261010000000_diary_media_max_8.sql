begin;

alter table if exists public.diary_images
  drop constraint if exists diary_images_position_check;

alter table if exists public.diary_images
  add constraint diary_images_position_check check (position between 1 and 8);

alter table if exists public.diary_media
  drop constraint if exists diary_media_slot_order_check;

alter table if exists public.diary_media
  add constraint diary_media_slot_order_check check (slot_order between 1 and 8);

commit;

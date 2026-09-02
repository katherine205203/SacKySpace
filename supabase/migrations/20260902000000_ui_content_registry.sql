begin;

create table if not exists public.ui_content_registry (
  id uuid primary key default gen_random_uuid(),
  content_key text not null unique,
  module text not null,
  screen text not null,
  element text not null,
  element_type text not null check (element_type in ('title', 'subtitle', 'section_title', 'button', 'tab', 'label', 'helper', 'empty_state', 'confirmation', 'system_message')),
  default_text_vn text not null check (btrim(default_text_vn) <> ''),
  text_vn text not null check (btrim(text_vn) <> ''),
  default_text_en text null,
  text_en text null,
  max_length integer null check (max_length is null or max_length > 0),
  max_length_mode text not null default 'warning' check (max_length_mode in ('hard', 'warning')),
  "protected" boolean not null default false,
  active boolean not null default true,
  description text null,
  placement_hint text null,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null
);

create index if not exists ui_content_registry_module_screen_idx on public.ui_content_registry (module, screen, element);
create index if not exists ui_content_registry_active_idx on public.ui_content_registry (active);

create or replace function public.validate_ui_content_registry()
returns trigger
language plpgsql
as $$
begin
  if btrim(new.text_vn) = '' then raise exception 'Vietnamese UI content cannot be blank'; end if;
  if new.max_length is not null and new.max_length_mode = 'hard' and char_length(new.text_vn) > new.max_length then
    raise exception 'UI content exceeds its hard max_length';
  end if;
  return new;
end;
$$;

drop trigger if exists ui_content_registry_validate on public.ui_content_registry;
create trigger ui_content_registry_validate before insert or update on public.ui_content_registry for each row execute function public.validate_ui_content_registry();
drop trigger if exists ui_content_registry_updated_at on public.ui_content_registry;
create trigger ui_content_registry_updated_at before update on public.ui_content_registry for each row execute function public.admin_touch_updated_at();

insert into public.ui_content_registry (content_key, module, screen, element, element_type, default_text_vn, text_vn, default_text_en, max_length, max_length_mode, "protected", placement_hint)
values
  ('home.landing.hero_eyebrow', 'Home', 'Landing', 'Hero eyebrow', 'label', 'Sắc Ký · Home', 'Sắc Ký · Home', null, 32, 'hard', false, 'Eyebrow trên hero Home'),
  ('home.landing.hero_subtitle', 'Home', 'Landing', 'Hero subtitle', 'subtitle', 'Hôm nay là một ngày mới, hãy lắng nghe mình nhé.', 'Hôm nay là một ngày mới, hãy lắng nghe mình nhé.', null, 100, 'warning', false, 'Mô tả dưới lời chào'),
  ('home.landing.orb_title', 'Home', 'Landing', 'Color Orb title', 'section_title', 'Khoảng màu hiện tại', 'Khoảng màu hiện tại', null, 48, 'warning', false, 'Tiêu đề cạnh Color Orb'),
  ('home.landing.checkin_cta', 'Home', 'Landing', 'Check-in CTA', 'button', 'Check-in ngay', 'Check-in ngay', null, 24, 'hard', false, 'Nút chính trong hero'),
  ('home.landing.journey_title', 'Home', 'Landing', 'Recent journey title', 'section_title', 'Hành trình gần đây', 'Hành trình gần đây', null, 48, 'warning', false, 'Section journey'),
  ('home.landing.journey_history', 'Home', 'Landing', 'Recent journey history link', 'button', 'Xem lịch sử', 'Xem lịch sử', null, 20, 'hard', false, 'Link lịch sử journey'),
  ('home.landing.action_title', 'Home', 'Landing', 'Action section title', 'section_title', 'Việc cần làm', 'Việc cần làm', null, 40, 'warning', false, 'Section action preview'),
  ('home.landing.action_view_all', 'Home', 'Landing', 'Action view all link', 'button', 'Xem tất cả', 'Xem tất cả', null, 20, 'hard', false, 'Link mở Action Space'),
  ('home.landing.action_today_empty', 'Home', 'Landing', 'Today action empty state', 'empty_state', 'Hôm nay chưa có việc cần làm.', 'Hôm nay chưa có việc cần làm.', null, 100, 'warning', false, 'Empty state tab hôm nay'),
  ('home.landing.action_upcoming_empty', 'Home', 'Landing', 'Upcoming action empty state', 'empty_state', 'Chưa có action sắp tới.', 'Chưa có action sắp tới.', null, 100, 'warning', false, 'Empty state tab sắp tới'),
  ('home.landing.action_overdue_empty', 'Home', 'Landing', 'Overdue action empty state', 'empty_state', 'Không có action quá hạn.', 'Không có action quá hạn.', null, 100, 'warning', false, 'Empty state tab quá hạn'),
  ('home.landing.action_unscheduled', 'Home', 'Landing', 'Unscheduled affordance', 'helper', '{count} việc chưa lên lịch', '{count} việc chưa lên lịch', null, 60, 'warning', false, 'Affordance riêng cho việc chưa lên lịch'),
  ('home.landing.diary_title', 'Home', 'Landing', 'Diary section title', 'section_title', 'Nhật ký hôm nay', 'Nhật ký hôm nay', null, 40, 'warning', false, 'Section diary preview'),
  ('home.landing.diary_empty', 'Home', 'Landing', 'Diary empty state', 'empty_state', 'Hôm nay vẫn còn một khoảng trống để bạn viết xuống điều đang ở lại.', 'Hôm nay vẫn còn một khoảng trống để bạn viết xuống điều đang ở lại.', null, 160, 'warning', false, 'Empty state diary preview'),
  ('home.landing.diary_start', 'Home', 'Landing', 'Diary empty CTA', 'button', 'Bắt đầu viết', 'Bắt đầu viết', null, 24, 'hard', false, 'CTA diary preview'),
  ('home.landing.for_me_title', 'Home', 'Landing', 'Personal surfaces title', 'section_title', 'Dành cho mình', 'Dành cho mình', null, 40, 'warning', false, 'Section future letter and gift'),
  ('home.landing.future_letter_title', 'Home', 'Landing', 'Future letter surface title', 'title', 'Thư cho mình', 'Thư cho mình', null, 32, 'warning', false, 'Surface Future Letter'),
  ('home.landing.gift_title', 'Home', 'Landing', 'Gift surface title', 'title', 'Quà cho ngày mai', 'Quà cho ngày mai', null, 40, 'warning', false, 'Surface Gift for Tomorrow'),

  ('checkin.landing.eyebrow', 'Check-in', 'Landing', 'Page eyebrow', 'label', 'Sắc Ký · Check-in', 'Sắc Ký · Check-in', null, 32, 'hard', false, 'Page header eyebrow'),
  ('checkin.landing.title', 'Check-in', 'Landing', 'Page title', 'title', 'Check-in', 'Check-in', null, 48, 'warning', false, 'Page header title'),
  ('checkin.landing.subtitle', 'Check-in', 'Landing', 'Page subtitle', 'subtitle', 'Dành vài phút lắng nghe và hiểu mình hơn mỗi ngày.', 'Dành vài phút lắng nghe và hiểu mình hơn mỗi ngày.', null, 100, 'warning', false, 'Page header subtitle'),
  ('checkin.landing.history', 'Check-in', 'Landing', 'History button', 'button', 'Lịch sử check-in', 'Lịch sử check-in', null, 32, 'hard', false, 'Page header action'),
  ('checkin.landing.emotion_title', 'Check-in', 'Landing', 'Emotion card title', 'title', 'Emotion Check-in', 'Emotion Check-in', null, 40, 'warning', false, 'Emotion entry card'),
  ('checkin.landing.emotion_copy', 'Check-in', 'Landing', 'Emotion card copy', 'helper', 'Hiểu cảm xúc hiện tại và chăm sóc bản thân tốt hơn mỗi ngày.', 'Hiểu cảm xúc hiện tại và chăm sóc bản thân tốt hơn mỗi ngày.', null, 140, 'warning', false, 'Emotion entry card'),
  ('checkin.landing.unknown_title', 'Check-in', 'Landing', 'Unknown card title', 'title', 'Unknown Check-in', 'Unknown Check-in', null, 40, 'warning', false, 'Unknown entry card'),
  ('checkin.landing.unknown_copy', 'Check-in', 'Landing', 'Unknown card copy', 'helper', 'Chưa gọi tên được cảm xúc? Viết ra những gì đang hiện diện.', 'Chưa gọi tên được cảm xúc? Viết ra những gì đang hiện diện.', null, 140, 'warning', false, 'Unknown entry card'),

  ('diary.landing.eyebrow', 'Diary', 'Landing', 'Page eyebrow', 'label', 'Diary', 'Diary', null, 24, 'hard', false, 'Page header eyebrow'),
  ('diary.landing.title', 'Diary', 'Landing', 'Page title', 'title', 'Nhật ký hôm nay', 'Nhật ký hôm nay', null, 48, 'warning', false, 'Page header title'),
  ('diary.landing.subtitle', 'Diary', 'Landing', 'Page subtitle', 'subtitle', 'Một khoảng lặng để bạn ghi lại điều đang ở cùng mình.', 'Một khoảng lặng để bạn ghi lại điều đang ở cùng mình.', null, 120, 'warning', false, 'Page header subtitle'),
  ('diary.landing.history', 'Diary', 'Landing', 'History button', 'button', 'Lịch sử nhật ký', 'Lịch sử nhật ký', null, 32, 'hard', false, 'Page header action'),

  ('actionspace.landing.eyebrow', 'Action Space', 'Landing', 'Page eyebrow', 'label', 'Sắc Ký · Capture → Plan → Reflect', 'Sắc Ký · Capture → Plan → Reflect', null, 48, 'hard', false, 'Page header eyebrow'),
  ('actionspace.landing.title', 'Action Space', 'Landing', 'Page title', 'title', 'Action Space', 'Action Space', null, 48, 'warning', false, 'Page header title'),
  ('actionspace.landing.subtitle', 'Action Space', 'Landing', 'Page subtitle', 'subtitle', 'Những bước nhỏ đang chờ bạn — có thể lên lịch, hoặc để dành cho lúc sẵn sàng.', 'Những bước nhỏ đang chờ bạn — có thể lên lịch, hoặc để dành cho lúc sẵn sàng.', null, 140, 'warning', false, 'Page header subtitle'),
  ('actionspace.landing.add_button', 'Action Space', 'Landing', 'Create action button', 'button', '＋ Viết action', '＋ Viết action', null, 24, 'hard', false, 'Page header action'),
  ('actionspace.landing.today_empty', 'Action Space', 'Landing', 'Today empty state', 'empty_state', 'Hôm nay chưa có bước nào được lên lịch.', 'Hôm nay chưa có bước nào được lên lịch.', null, 120, 'warning', false, 'Today empty state'),

  ('futureletter.landing.eyebrow', 'Future Letter', 'Landing', 'Page eyebrow', 'label', 'FutureMe / Future Letter', 'FutureMe / Future Letter', null, 40, 'hard', false, 'Page header eyebrow'),
  ('futureletter.landing.title', 'Future Letter', 'Landing', 'Page title', 'title', 'Những điều mình gửi về sau', 'Những điều mình gửi về sau', null, 64, 'warning', false, 'Page header title'),
  ('futureletter.landing.subtitle', 'Future Letter', 'Landing', 'Page subtitle', 'subtitle', 'Viết từ hôm nay, để một phiên bản tương lai của mình gặp được những lời này.', 'Viết từ hôm nay, để một phiên bản tương lai của mình gặp được những lời này.', null, 140, 'warning', false, 'Page header subtitle'),
  ('futureletter.landing.new_button', 'Future Letter', 'Landing', 'Create letter button', 'button', '＋ Viết thư mới', '＋ Viết thư mới', null, 24, 'hard', false, 'Page header action'),
  ('futureletter.landing.empty_title', 'Future Letter', 'Landing', 'Empty state title', 'empty_state', 'Chưa có lá thư nào ở đây', 'Chưa có lá thư nào ở đây', null, 64, 'warning', false, 'Empty library title'),
  ('futureletter.landing.empty_copy', 'Future Letter', 'Landing', 'Empty state copy', 'empty_state', 'Một lá thư không phải lời nhắc. Nó là một điều mình muốn gửi tới chính mình vào một thời điểm có ý nghĩa.', 'Một lá thư không phải lời nhắc. Nó là một điều mình muốn gửi tới chính mình vào một thời điểm có ý nghĩa.', null, 180, 'warning', false, 'Empty library copy'),

  ('gift.landing.eyebrow', 'Gift for Tomorrow', 'Landing', 'Page eyebrow', 'label', 'Sắc Ký · Gift for Tomorrow', 'Sắc Ký · Gift for Tomorrow', null, 44, 'hard', false, 'Page header eyebrow'),
  ('gift.landing.title', 'Gift for Tomorrow', 'Landing', 'Page title', 'title', 'Một món quà cho ngày mai.', 'Một món quà cho ngày mai.', null, 64, 'warning', false, 'Page header title'),
  ('gift.landing.subtitle', 'Gift for Tomorrow', 'Landing', 'Page subtitle', 'subtitle', 'Gửi cho mình một điều nhỏ hôm nay. Ngày mai, mình sẽ nhận lại nó.', 'Gửi cho mình một điều nhỏ hôm nay. Ngày mai, mình sẽ nhận lại nó.', null, 140, 'warning', false, 'Page header subtitle'),
  ('gift.landing.question_button', 'Gift for Tomorrow', 'Landing', 'Question CTA', 'button', 'Gửi một câu hỏi', 'Gửi một câu hỏi', null, 28, 'hard', false, 'Gift hero CTA'),
  ('gift.landing.message_button', 'Gift for Tomorrow', 'Landing', 'Message CTA', 'button', 'Gửi lời nhắn', 'Gửi lời nhắn', null, 24, 'hard', false, 'Gift hero secondary CTA'),

  ('system.auth.required', 'System', 'Global', 'Authentication required', 'system_message', 'Bạn cần đăng nhập để tiếp tục.', 'Bạn cần đăng nhập để tiếp tục.', null, 80, 'hard', true, 'Protected authentication fallback')
on conflict (content_key) do nothing;

alter table public.ui_content_registry enable row level security;
grant select on public.ui_content_registry to authenticated;
grant update on public.ui_content_registry to authenticated;

drop policy if exists ui_content_active_read on public.ui_content_registry;
create policy ui_content_active_read on public.ui_content_registry for select to authenticated using (active = true or public.is_admin_owner());
drop policy if exists ui_content_owner_update on public.ui_content_registry;
create policy ui_content_owner_update on public.ui_content_registry for update to authenticated using (public.is_admin_owner()) with check (public.is_admin_owner());

commit;

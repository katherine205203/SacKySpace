begin;

insert into public.ui_content_registry (content_key, module, screen, element, element_type, default_text_vn, text_vn, default_text_en, max_length, max_length_mode, "protected", placement_hint)
values
  ('actionspace.landing.history_button', 'Action Space', 'Landing', 'History button', 'button', 'Lịch sử', 'Lịch sử', null, 20, 'hard', false, 'Link mở lịch sử Action'),
  ('actionspace.history.eyebrow', 'Action Space', 'History', 'Page eyebrow', 'label', 'Sắc Ký · Action History', 'Sắc Ký · Action History', null, 40, 'hard', false, 'Eyebrow trên lịch sử Action'),
  ('actionspace.history.title', 'Action Space', 'History', 'Page title', 'title', 'Lịch sử Action', 'Lịch sử Action', null, 48, 'warning', false, 'Tiêu đề lịch sử Action'),
  ('actionspace.history.subtitle', 'Action Space', 'History', 'Page subtitle', 'subtitle', 'Đọc lại những gì mình đã làm theo thời gian, từng ngày, hoặc qua Reflection.', 'Đọc lại những gì mình đã làm theo thời gian, từng ngày, hoặc qua Reflection.', null, 140, 'warning', false, 'Mô tả các góc nhìn lịch sử')
on conflict (content_key) do nothing;

commit;

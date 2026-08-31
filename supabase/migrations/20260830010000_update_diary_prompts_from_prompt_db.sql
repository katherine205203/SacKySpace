begin;

update public.diary_prompts
set active = false
where id like 'DIARY_%';

insert into public.diary_prompts (id, code, text_vn, emoji, hex_color, sort_order)
values
  ('UPR_017', 'upr_017', 'Điều gì khiến mình đang chưa cảm thấy hài lòng, trọn vẹn? Mình đang có những kỳ vọng nào? Mình đang mong điều gì khác đi?', '🌫️', '#6F78A8', 17),
  ('UPR_018', 'upr_018', 'Có nhu cầu hay mong muốn nào của bản thân mình đã xuất hiện nhưng chưa được nói ra không?', '💭', '#9A6FC2', 18),
  ('UPR_019', 'upr_019', 'Điều mình đã làm và cảm thấy xứng đáng để tự ghi nhận bản thân?', '🏅', '#D69B3C', 19),
  ('UPR_020', 'upr_020', 'Những suy nghĩ vu vơ hoặc những ‘Eureka moment’ mà mình chưa kịp chải vuốt?', '💡', '#E0A83E', 20),
  ('UPR_021', 'upr_021', 'Một trải nghiệm trong quá khứ mà mình bất chợt nhớ đến vào hôm nay?', '🕰️', '#94745E', 21),
  ('UPR_022', 'upr_022', 'Mình đã nhận ra thêm điều gì đó về bản thân mình?', '🪞', '#7566C7', 22),
  ('UPR_023', 'upr_023', 'Một điều không tích cực mà mình muốn xả ra, muốn let it go.', '🍃', '#5DA87A', 23),
  ('UPR_024', 'upr_024', 'Vùng ‘xám’ của chính mình?', '🌗', '#73727D', 24),
  ('UPR_025', 'upr_025', 'Điều “tử tế” của hôm nay mà mình nhận được hoặc cho đi.', '🌤️', '#D48192', 25),
  ('UPR_026', 'upr_026', 'Điều mình biết ơn cho hôm nay.', '🌱', '#6EA06E', 26)
on conflict (id) do update set
  code = excluded.code,
  text_vn = excluded.text_vn,
  emoji = excluded.emoji,
  hex_color = excluded.hex_color,
  active = true,
  sort_order = excluded.sort_order;

commit;

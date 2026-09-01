update public.action_reflection_outcomes
set label_vn = case id
  when 'better' then 'Ổn hơn'
  when 'lighter' then 'Thoải mái / thông suốt hơn nhiều'
  when 'same' then 'Không có gì khác biệt'
  when 'not_better' then 'Tệ hơn'
  when 'other' then 'Khác'
  else label_vn
end
where id in ('better', 'lighter', 'same', 'not_better', 'other');

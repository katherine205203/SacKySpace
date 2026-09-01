begin;

insert into public.gift_box_styles (id, name, palette, ribbon, shape, config, sort_order) values
  ('box-cobalt-lemon', 'Biển xanh & chanh sáng', array['#245BDB', '#D9F24F'], '#D9F24F', 'round', '{"seal":"✦"}', 5),
  ('box-periwinkle-peach', 'Mơ tím & đào nhạt', array['#8D8BFF', '#FFB79C'], '#FFB79C', 'tall', '{"seal":"✧"}', 6),
  ('box-berry-blush', 'Đỏ berry & hồng phấn', array['#B83D68', '#FFB6C9'], '#FFB6C9', 'square', '{"seal":"♡"}', 7),
  ('box-teal-tangerine', 'Xanh ngọc & cam quýt', array['#159A9C', '#FF923C'], '#FF923C', 'round', '{"seal":"✹"}', 8)
on conflict (id) do update set
  name = excluded.name,
  palette = excluded.palette,
  ribbon = excluded.ribbon,
  shape = excluded.shape,
  config = excluded.config,
  sort_order = excluded.sort_order,
  active = true;

commit;

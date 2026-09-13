begin;

-- Allow up to three secondary emotions and keep the database rule aligned with the app.
insert into public.admin_runtime_configs (
  config_key,
  module,
  value_type,
  scope,
  default_value,
  published_value,
  draft_value,
  configurability_level,
  validation_schema,
  dependency_tags,
  published_version
)
values (
  'checkin.max_secondary_emotions',
  'Check-in',
  'number',
  'global',
  '3',
  '3',
  '3',
  'basic',
  '{"min":0,"max":6}',
  array['checkin.selection','checkin_secondary_emotions'],
  1
)
on conflict (config_key) do update
set default_value = excluded.default_value,
    published_value = excluded.published_value,
    draft_value = excluded.draft_value,
    validation_schema = excluded.validation_schema;

create or replace function public.validate_secondary_emotion_limit()
returns trigger
language plpgsql
as $$
declare
  primary_emotion text;
  relation_count integer;
  selection_limit integer := public.admin_runtime_number('checkin.max_secondary_emotions', 3)::integer;
begin
  select primary_emotion_id into primary_emotion from public.checkins where id = new.checkin_id;
  if primary_emotion = new.emotion_id then raise exception 'Primary emotion cannot also be a secondary emotion'; end if;
  select count(*) into relation_count from public.checkin_secondary_emotions where checkin_id = new.checkin_id and not (tg_op = 'UPDATE' and checkin_id = old.checkin_id and emotion_id = old.emotion_id);
  if relation_count >= selection_limit then raise exception 'A check-in has reached its secondary emotion limit'; end if;
  return new;
end;
$$;

commit;

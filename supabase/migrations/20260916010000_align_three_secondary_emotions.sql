begin;

-- Keep the deployed runtime registry aligned with the three-secondary product rule.
-- This is intentionally a forward migration: older migrations may already be applied.
update public.admin_runtime_configs
set default_value = '3'::jsonb,
    published_value = '3'::jsonb,
    draft_value = '3'::jsonb,
    validation_schema = '{"min":0,"max":6}'::jsonb,
    updated_at = now()
where config_key = 'checkin.max_secondary_emotions';

-- Preserve the safe fallback when the runtime registry is unavailable.
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
  if primary_emotion = new.emotion_id then
    raise exception 'Primary emotion cannot also be a secondary emotion';
  end if;
  select count(*) into relation_count
  from public.checkin_secondary_emotions
  where checkin_id = new.checkin_id
    and not (tg_op = 'UPDATE' and checkin_id = old.checkin_id and emotion_id = old.emotion_id);
  if relation_count >= selection_limit then
    raise exception 'A check-in has reached its secondary emotion limit';
  end if;
  return new;
end;
$$;

commit;

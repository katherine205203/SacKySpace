-- Additive compatibility migration for the Future Letter condition builder.
-- Existing rule rows keep their ids and config snapshots; only the allowed type
-- vocabulary is expanded so old letters continue to load unchanged.
begin;

alter table public.future_letter_rules
  drop constraint if exists future_letter_rules_rule_type_check;
alter table public.future_letter_rules
  add constraint future_letter_rules_rule_type_check check (rule_type in (
    'random_date', 'random_condition', 'specific_date', 'minimum_wait', 'time_window',
    'checkin_streak', 'checkin_total', 'checkin_frequency', 'checkin_return_after_inactivity',
    'diary_streak', 'diary_total', 'journey_total', 'emotion_frequency', 'emotion_condition', 'done_action'
  ));

alter table public.future_letter_trigger_events
  drop constraint if exists future_letter_trigger_events_trigger_type_check;
alter table public.future_letter_trigger_events
  add constraint future_letter_trigger_events_trigger_type_check check (trigger_type in (
    'random_date', 'random_condition', 'specific_date', 'minimum_wait', 'time_window',
    'checkin_streak', 'checkin_total', 'checkin_frequency', 'checkin_return_after_inactivity',
    'diary_streak', 'diary_total', 'journey_total', 'emotion_frequency', 'emotion_condition', 'done_action'
  ));

commit;

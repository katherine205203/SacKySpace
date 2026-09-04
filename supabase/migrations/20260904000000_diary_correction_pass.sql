begin;

alter table public.diary_entries alter column title drop not null;
alter table public.diary_entries alter column overall_text drop not null;
alter table public.diary_entries drop constraint if exists diary_entries_title_check;
alter table public.diary_entries drop constraint if exists diary_entries_overall_text_check;
alter table public.diary_entries add constraint diary_entries_title_check check (title is null or btrim(title) <> '');
alter table public.diary_entries add constraint diary_entries_overall_text_check check (overall_text is null or btrim(overall_text) <> '');

alter table public.diary_prompt_responses add column if not exists id uuid;
update public.diary_prompt_responses set id = gen_random_uuid() where id is null;
alter table public.diary_prompt_responses alter column id set default gen_random_uuid();
alter table public.diary_prompt_responses alter column id set not null;
alter table public.diary_prompt_responses drop constraint if exists diary_prompt_responses_pkey;
alter table public.diary_prompt_responses drop constraint if exists diary_prompt_responses_prompt_id_fkey;
alter table public.diary_prompt_responses add constraint diary_prompt_responses_pkey primary key (id);
alter table public.diary_prompt_responses alter column prompt_id drop not null;
alter table public.diary_prompt_responses add constraint diary_prompt_responses_diary_prompt_unique unique (diary_id, prompt_id);

commit;

# START HERE — SacKy Check-in v2 Codex Pack

This folder is designed to be copied into the SacKy repository, ideally as:

`docs/checkin-v2/`

Read in this order:

1. `CHECKIN_V2_PRODUCT_SPEC.md` — authoritative product, UX, data and acceptance contract.
2. `UI_REFERENCE_INDEX.md` — visual reference mapping and screenshot corrections.
3. `data/` — authoritative reference datasets and legacy architecture workbook.
4. `CODEX_MASTER_BUILD_PROMPT.md` — one-shot implementation instruction.

### Reference dataset authority

- Emotion rows: `data/emotions_117_remap_authoritative.tsv` wins.
- Emotion family display metadata: `data/emotion_families_11.tsv`.
- Needs / groups: `data/needs.tsv`, `data/need_groups.tsv`.
- Context: `data/contexts.tsv`.
- Unknown prompts: `data/unknown_prompts.tsv`.
- Care/action suggestions: `data/care_actions.tsv`.
- Full legacy workbook: retained for reference only; do not reproduce old sheet-era Checkin_Log schema.

### Existing repo/backend assumptions

- React + TypeScript + Vite foundation already exists.
- Git repo is on `main`, tracking GitHub origin.
- `@supabase/supabase-js` and a validated browser client already exist.
- `.env.local` is ignored; `.env.example` is tracked.
- Supabase CLI is installed in the repo and initialized.
- Hosted Supabase project is linked to ref `aqelusxjkayiuninbmnw`.
- Docker is intentionally not installed and is not required for this hosted-first build.


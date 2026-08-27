# CODEX MASTER BUILD PROMPT — SẮC KÝ CHECK-IN v2

Work in the current SacKy repository. Build the full Check-in v2 module end-to-end in one implementation pass as far as the environment allows.

Before changing code, read every file in `docs/checkin-v2/`, especially:

- `CHECKIN_V2_PRODUCT_SPEC.md`
- `UI_REFERENCE_INDEX.md`
- all TSV files in `docs/checkin-v2/data/`
- inspect all images in `docs/checkin-v2/ui/`

Treat the written product specification as authoritative for behavior and data rules. Treat the UI images as authoritative for visual direction, layout, density and composition. If they conflict, the written spec wins.

## Existing foundation — do not redo it

- React + TypeScript + Vite is already initialized.
- Git is already initialized and connected to GitHub.
- Supabase browser client foundation already exists.
- Supabase CLI is already installed and `supabase/` already exists.
- Hosted Supabase project is already linked to project ref `aqelusxjkayiuninbmnw`.
- Docker is intentionally absent. Do not install Docker and do not require a local Supabase stack.
- Do not expose, print or commit any secrets.

## Build scope

Implement the complete Check-in v2 scope in `CHECKIN_V2_PRODUCT_SPEC.md`, including:

1. Supabase migrations for normalized Check-in schema, relational child tables, minimal shared Reminder/action persistence, RLS, validation triggers, immutable `created_at`, and `updated_at` behavior.
2. Version-controlled reference-data seed migration generated from the authoritative TSV files. Use emotion remap as authority and seed exactly the supplied IDs/data.
3. Minimal owner-only authentication gate needed for RLS use. No public signup UI.
4. App shell/navigation aligned to current scope: Home, Check-in, Diary, Reminder, Future Letter, Gift for Tmr; Admin Studio bottom. Other modules may remain placeholders.
5. Check-in subtab/navigation: Create Check-in and History.
6. Landing with Emotion and Unknown modes.
7. Emotion Core: search VN/EN names + descriptions, 11 family filters, primary selection, 5 intensity levels, optional note, right detail rail, explicit Save only.
8. Saved 3-option Decision Modal.
9. Deep Dive screens: Secondary Emotion → Need → Context. Each is a separate screen; no redundant top summary strip; persistent right summary rail; same note field; Quay lại / Lưu nhanh / Tiếp tục.
10. Final Review with direct section edit and return-to-review behavior.
11. Unknown flow and same-record Unknown→Emotion conversion.
12. Action modal: random 3 global suggestions, refresh, all, custom, none, max 2; action config for title/date/time/note.
13. History: time presets, custom range, filters, intensity-weighted hue-clustered Color Orb, created_at-desc list, detail drawer, edit and cascade delete.
14. Reusable domain/service/repository architecture so arbitrary UI components do not call Supabase directly.
15. Targeted automated tests for core rules and utilities.

## UI implementation contract

Implement **Chromatic Flat Light**. Keep the interface bright, clean and practical. Use flat vivid violet as brand accent, cool near-white canvas, white surfaces, dark navy ink, restrained borders and minimal shadow. Semantic reference colors create vibrance. Do not introduce heavy gradients, glassmorphism, glow, decorative backgrounds, mascot art or excessive cardification. The Color Orb is the intentional multi-color signature exception and must be built from organic contiguous color regions, intensity weighted and hue clustered.

Use a desktop layout with fixed left sidebar, wide center workspace and sticky right detail/summary rail where specified. Default emotion cards remain mostly neutral and compact; show emoji/icon + VN name + EN name. Descriptions live in the right rail. Selected state must be clearly captured with border/tint/check indicator.

On Secondary Emotion / Need / Context screens, the right rail is the summary. Do not add another summary strip across the top.

Preserve inventory scroll and filters when selecting/deselecting. Do not key/remount the whole list based on selection state.

## Implementation expectations

- Prefer minimal, maintainable dependencies. React Router is allowed/expected if routing is not already present. TanStack Query is optional if it materially improves reference caching and mutation invalidation.
- Keep data access behind repositories/services.
- Cache reference data rather than refetching on each click.
- Use app-local timezone semantics; default `Asia/Ho_Chi_Minh` unless existing app settings already provide a timezone abstraction.
- Never use service-role keys in frontend code.
- Never commit `.env.local`, Supabase access tokens, DB passwords or secret keys.
- Do not install Docker.
- Do not build Garden or MyLib.
- Do not redesign the supplied visual direction.

## Remote database execution

Create migrations and seeds first, inspect them carefully, then apply them to the already-linked hosted Supabase project if the CLI can do so without exposing credentials. If `supabase db push` requires an interactive database password that Codex cannot safely obtain, stop only at that execution gate, report the exact command the user must run, and continue completing all code that does not require the remote migration to have already been applied. Do not guess/store the password.

## Verification before finishing

Run and fix until clean:

- `npm run lint`
- `npm run build`
- all added tests

Also verify:

- `.env.local` remains ignored and untracked
- no secret/service-role key is tracked
- migration and seed files are tracked
- reference-data counts match the pack: 117 emotions, 11 emotion families, 19 needs, 6 need groups, 16 contexts, 16 Unknown prompts, 26 care actions
- History sorts by immutable `created_at DESC`
- secondary max 2 / need max 3 / context max 2 / action max 2
- Unknown conversion preserves the same ID and original `created_at`
- deleting a check-in cascades linked reminder/action rows
- generated orb algorithm is deterministic for the same input set

When complete, commit all safe implementation changes with a clear message such as:

`feat: build Check-in v2 end to end`

Push to `origin/main` only after lint/build/tests pass. At the end report:

1. architecture/files created
2. migrations and seed counts
3. remote migration status
4. implemented screens and flows
5. tests/build/lint results
6. commit hash and push status
7. any single remaining manual step, if unavoidable (for example creating the one owner Supabase user or entering DB password interactively)


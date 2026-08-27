# SẮC KÝ v2 — CHECK-IN PRODUCT SPECIFICATION

**Status:** Build-ready baseline for Codex  
**Target:** Web-first React + TypeScript + Vite, light theme first, mobile-ready architecture  
**Backend:** Hosted Supabase (already connected in app client; Supabase CLI already initialized and linked to project ref `aqelusxjkayiuninbmnw`)  
**Scope of this document:** Check-in module only. Do not build Garden or MyLib. Other navigation items remain placeholders: Home, Diary, Reminder, Future Letter, Gift for Tmr. Admin Studio remains accessible at the bottom of the sidebar.

## 1. Source-of-truth rules

This specification is the authoritative source of truth for Check-in v2 product behavior and current implementation decisions. The attached UI images are authoritative for overall visual direction, composition, density, spacing and interaction feel, but **written product rules in this document always override any conflicting detail in a generated mockup**.

Reference data authority is locked as follows:

1. `data/emotions_117_remap_authoritative.tsv` is authoritative for all 117 emotion rows, including `emotion_family_id`, VN/EN names, emoji, `color_hex`, descriptions, active flag and sort order.
2. `data/emotion_families_11.tsv` supplies display metadata for the 11 families used by the remapped emotion set. Ignore legacy unused families outside EFAM_001..EFAM_011 for Check-in v2.
3. `data/need_groups.tsv` + `data/needs.tsv` are authoritative for need reference data.
4. `data/contexts.tsv` is authoritative for context reference data.
5. `data/unknown_prompts.tsv` is authoritative for Unknown Check-in prompts.
6. `data/care_actions.tsv` is authoritative for action suggestions.
7. `data/SacKy_Data_Architecture_v3_0_COMPLETE.xlsx` is retained as broader legacy/reference architecture. Its old `Checkin_Log` sheet-era schema is **reference only**, not the target Supabase schema. The relational Supabase model below supersedes it.

Current reference counts: **117 emotions / 11 emotion families / 19 needs / 6 need groups / 16 contexts / 16 Unknown prompts / 26 care actions**.

## 2. Check-in v2 product model

Check-in has exactly **two entry modes**:

- **Emotion Check-in:** user can name the primary emotion.
- **Unknown Check-in:** user cannot yet name the emotion and writes first.

There is no separate Need-first mode in v2.

A valid Emotion Check-in requires exactly **1 primary emotion + 1 intensity value (1–5)**. Secondary emotions, needs, contexts, note and actions are optional. A saved Unknown Check-in requires **1 selected prompt + written response**. A user can later convert an Unknown Check-in into a normal Emotion Check-in without changing its original `created_at`.

### Emotion flow

`Landing → Emotion Core → explicit Save → 3-option Decision Modal`

The Emotion Core screen contains primary emotion selection, intensity and optional note on the same screen. **Nothing is persisted merely by selecting primary emotion or intensity. The record is created only when the user explicitly presses Save.** After successful save, show the 3-option Decision Modal:

1. **Vậy là đủ** → finish and return Home.
2. **Đào sâu hơn** → go to Secondary Emotion screen.
3. **Chọn action** → open Action Modal directly.

If the user chooses Deep Dive, the sequence is:

`Secondary Emotion → Need → Context → Review`

There is **no separate Note screen**. The same optional note field remains available on Emotion Core and every Deep Dive screen. The Deep Dive screens each have a persistent right-side summary rail; therefore they must **not add a second summary strip at the top**.

Deep Dive footer behavior:

- **Quay lại** on the left.
- **Tiếp tục** on the right. If the current optional step is empty, Continue simply acts as Skip. If the user selected values or edited the note, Continue saves current step state and proceeds.
- **Lưu nhanh** ends the Deep Dive at the current point. It saves current state, then opens a compact completion modal with only **Vậy là đủ** and **Chọn action**.

The final Review screen always appears when the user proceeds through Context. Review shows all saved information and provides Edit on each section. Editing a section must return the user directly to that section with current values prefilled; after Save, the app returns directly to Review. The user must never be forced to replay the entire journey.

### Unknown flow

`Landing → Unknown Screen → select prompt + write → explicit Save → 3-option Decision Modal`

After Unknown is saved:

1. **Vậy là đủ** → remains an Unknown Check-in; finish and return Home.
2. **Chọn action** → remains an Unknown Check-in; open Action Modal.
3. **Đào sâu hơn** → begin conversion to Emotion Check-in.

Conversion must reuse the **same check-in record** and preserve the original `created_at`. The selected prompt remains as technical/origin metadata and the written response remains the note content. The user is sent to Emotion Core to choose primary emotion + intensity. Until the user presses Save on Emotion Core, the record remains Unknown. Once Save succeeds, update the same record to Emotion mode, keep original `created_at`, set `updated_at`, and show the normal 3-option Emotion Decision Modal. From then onward, the record behaves like any normal Emotion Check-in. History title and visual color become the primary emotion name and primary emotion `color_hex`.

## 3. Selection rules and interaction behavior

Primary emotion is exactly 1. Secondary emotion is optional, **max 2**. A secondary emotion may come from the same family as the primary, but the primary emotion itself cannot be selected again as a secondary emotion. Needs are optional, **max 3**, with no primary/secondary distinction. Contexts are optional, **max 2**, with no primary/secondary distinction.

All large selectors must support clear captured selection state. Once the max is reached, all unselected items are visibly greyed/disabled while selected items remain interactive so the user can remove one. Removing a selected item immediately re-enables eligible items. Selecting or deselecting an item must **not remount the inventory or reset its scroll position**. Search/filter state and current scroll position must survive selection changes.

Emotion search must match VN name, EN name, VN description and EN description. Family filters act as filters, not a separate journey step. Include `Tất cả` plus the 11 active family filters. Since the emotion inventory is only 117 records, load/cache the reference dataset once and perform responsive client-side filtering/search unless there is a compelling reason otherwise.

Intensity labels are locked to:

1. **Thoáng qua**
2. **Nhẹ nhàng**
3. **Vừa phải**
4. **Hiện diện rõ**
5. **Rất mạnh**

The note is one continuous field across the journey. Changes made on any screen must appear in the right summary rail and on subsequent screens.

## 4. Screen architecture

| Screen / state | Required UI and behavior |
|---|---|
| **Landing** | Two equal-status mode cards: Emotion Check-in and Unknown Check-in. Emotion may be visually recommended, but Unknown is not a degraded fallback. Include link/subtab to History. |
| **Emotion Core** | Search across names + descriptions; family filters; compact emotion grid; selected primary state; sticky detail rail on right showing VN/EN name + VN/EN description; intensity 5 levels; optional note; Cancel and explicit Save. |
| **Decision Modal** | Appears only after successful explicit save. Summary of saved core state + three options: Vậy là đủ / Đào sâu hơn / Chọn action. |
| **Secondary Emotion** | Same searchable/filterable emotion inventory, primary excluded; max 2; persistent right summary rail; optional note; Quay lại / Lưu nhanh / Tiếp tục. **No redundant top summary strip.** |
| **Need** | Need-group filters, searchable or scan-friendly need inventory, max 3, persistent right summary rail, optional note, Quay lại / Lưu nhanh / Tiếp tục. **No redundant top summary strip.** |
| **Context** | Context-group filters and context inventory, max 2, persistent right summary rail, optional note, Quay lại / Lưu nhanh / Tiếp tục. **No redundant top summary strip.** |
| **Review** | Readable sections for Primary Emotion, Intensity, Secondary Emotions, Needs, Contexts, Note. Each has Edit. Final actions: Vậy là đủ / Chọn action. |
| **Action Modal** | Random 3 global active suggestions, Refresh random 3, Xem tất cả, Tự viết action, Thôi không chọn. Max 2 actions. Selected action opens/configures title, planned date, due time and note before Save. |
| **Unknown** | Prompt inventory using active prompts by sort order; one selected prompt; large writing area; Cancel + explicit Save; right contextual rail. |
| **History subtab** | `Tạo check-in | Lịch sử`. Time presets All / Hôm nay / Tuần này / Tháng này + inclusive custom date range. Filters: Emotion Family / Emotion / Need / Context. Scope summary with Color Orb. History rows sorted by `created_at DESC`. Detail drawer/rail with Edit and Delete. |
| **Detail/Edit** | Reuse the same flow components with existing values prefilled. User may add/remove/change any field after completion. `created_at` cannot change; only `updated_at` changes. |

## 5. UI style guide — Chromatic Flat Light

The target is **light, flat, vivid, practical and contemporary**. Vibrance must come from semantic color and contrast, not from decorative effects.

Core tokens / direction:

- App canvas: cool near-white / very light lavender, around `#F8F8FC`.
- Primary surfaces: `#FFFFFF`.
- Main ink: near-black navy, around `#17162A`.
- Secondary text: slate-violet, around `#737087`.
- Brand/system accent: vivid violet around `#6D3CF3`; hover may deepen slightly. Use flat fills.
- Border: cool neutral-lilac around `#E6E3EF`.
- Brand tint / selected background: very light violet around `#F2EEFF`.
- Radius: generally 12–16px; do not turn every control into a pill.
- Shadows: minimal. Main layout relies on spacing + border. Shadows reserved for modal/floating surfaces.
- Typography: modern Vietnamese-friendly sans. Prefer **Be Vietnam Pro** or a close equivalent. Strong hierarchy, 700–800 for page/section headings, 400–600 for UI/body.
- Motion: restrained 120–200ms for capture/select/grey-out/modal transition. No cartoon bounce.
- No heavy glassmorphism, no glow, no decorative gradient backgrounds, no pastel wash across the whole interface.
- Generated mockups may show gradient violet buttons; implementation should prefer **flat vivid violet** unless the gradient is absolutely necessary. The only signature multi-color visual is the Color Orb.

Emotion/Need/Context cards should remain compact and scan-friendly. Default emotion card shows emoji/icon + VN name + EN name; descriptions belong in the right rail. Default card stays mostly neutral. Semantic `color_hex` may appear in icon background, dot, small accent or subtle tint. Selected state uses a clear 1.5–2px semantic/brand border + roughly 8–12% tint + check indicator. Do not fill all 117 default cards with highly saturated color.

Desktop layout uses a fixed left app sidebar, a wide central workspace and a sticky right detail/summary rail of roughly 320–360px when relevant. On Deep Dive screens, the right rail is the only persistent summary; do not duplicate a top summary block.

## 6. Color Orb contract

Color Orb is a core Sắc Ký signature visual. It must **not** be a random smooth gradient sphere. It is an orb made from contiguous organic flat color regions derived from check-ins.

For History/Home time scope:

1. Include only current Emotion Check-ins with a primary emotion. Unknown records do not contribute until converted.
2. Each check-in contributes its primary emotion `color_hex`.
3. Weight contribution by intensity 1–5.
4. Convert colors to a hue-aware perceptual representation (OKLCH preferred; HSL/HSV acceptable if implemented carefully).
5. Sort/cluster nearby hues deterministically so similar colors remain adjacent instead of being scattered around the orb.
6. Region area should be proportional to aggregated intensity-weighted contribution.
7. Preserve distinct neighboring hex colors where useful, but keep them contiguous within the same hue cluster. Avoid visual noise.
8. The result must be stable/deterministic for the same input set.

History scope rules: `Hôm nay` uses app-local today; `Tuần này` is Monday–Sunday; `Tháng này` is day 1 through the last day of the month; custom range is inclusive. All time semantics use the app timezone; v2 may default to `Asia/Ho_Chi_Minh` and later expose configuration.

## 7. History and lifecycle rules

History sorting is always `created_at DESC`, regardless of `updated_at`. Editing an old check-in must never make it jump to the top. `created_at` must be immutable at both application and database level. Editing any field updates `updated_at` only.

History supports time scope plus filters for Emotion Family, Emotion, Need and Context. Opening a row shows detail in a side drawer/rail. User may edit or delete any check-in. Deleting a check-in must delete all linked actions/reminders as well. For v2 Check-in, delete is a real deletion from active user data, using database cascade for child rows.

Streak rule: a local calendar day with at least one saved Check-in counts as one streak day, regardless of how many check-ins exist that day.

## 8. Action contract

Action suggestions come from the global active `care_actions` library. Initial modal shows 3 unique random suggestions. Refresh produces another random set. `Xem tất cả` exposes the complete active library. `Tự viết action` allows custom title. `Thôi không chọn` closes without creating an action.

A Check-in can have **max 2 linked actions**. Each selected/custom action supports configurable title, planned date, due time and note. Date/time may remain optional; if a time is entered without a date, default planned date to the user’s current local date. Suggested action cards may show `duration_min` from reference data.

Persist these as the initial shared foundation for the future Reminder module; do not build Reminder UI in this task. Linked records must cascade-delete when their source Check-in is deleted.

## 9. Target Supabase schema

Use normalized relational tables rather than the old sheet-era snapshot strings.

### Reference tables

- `emotion_families`
- `emotions`
- `need_groups`
- `needs`
- `contexts`
- `unknown_prompts`
- `care_actions`

Seed from the attached TSV files. Preserve the supplied string IDs (`EMO_001`, `EFAM_001`, `NEED_001`, etc.) as primary keys for reference stability. Use UTF-8 and preserve emoji/descriptions exactly.

### User-owned tables

**`checkins`**

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `checkin_type text not null check (checkin_type in ('emotion','unknown'))`
- `primary_emotion_id text null references emotions(emotion_id)`
- `intensity smallint null check (intensity between 1 and 5)`
- `note text null`
- `unknown_prompt_id text null references unknown_prompts(prompt_id)` — preserved even after Unknown → Emotion conversion for origin traceability
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Validation rules: Emotion records require `primary_emotion_id` + `intensity`. Unknown records require `unknown_prompt_id` + nonblank note. The app does not create an Emotion record before explicit Save, so there is no need to persist incomplete Emotion drafts in this table.

**`checkin_secondary_emotions`**

- `checkin_id uuid references checkins(id) on delete cascade`
- `emotion_id text references emotions(emotion_id)`
- `position smallint`
- PK or unique on `(checkin_id, emotion_id)`
- enforce max 2 per check-in
- reject `emotion_id = checkins.primary_emotion_id`

**`checkin_needs`**

- `checkin_id uuid references checkins(id) on delete cascade`
- `need_id text references needs(need_id)`
- `position smallint`
- unique `(checkin_id, need_id)`
- enforce max 3

**`checkin_contexts`**

- `checkin_id uuid references checkins(id) on delete cascade`
- `context_id text references contexts(context_id)`
- `position smallint`
- unique `(checkin_id, context_id)`
- enforce max 2

**`reminders`** — minimal shared persistence for Check-in actions and future Reminder module

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `origin text not null default 'checkin'`
- `source_checkin_id uuid null references checkins(id) on delete cascade`
- `care_action_id text null references care_actions(care_action_id)`
- `title text not null`
- `note text null`
- `planned_date date null`
- `due_time time null`
- `status text not null default 'pending'`
- `completed_at timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- enforce max 2 records where `origin='checkin'` per `source_checkin_id`

Use triggers/functions where row-count constraints cannot be expressed as simple CHECK constraints. Add a reusable `updated_at` trigger. Add a trigger that rejects attempts to change `checkins.created_at` after insert.

### RLS

Enable RLS on all user-owned tables. Policies must enforce `auth.uid() = user_id`. For join tables without direct `user_id`, authorize through the parent `checkins.user_id`. Reference tables may be readable by authenticated users; mutation should remain migration/admin-controlled for this phase. Do not use service-role keys in the browser.

## 10. Architecture and code organization

UI must not call Supabase directly from arbitrary components. Use a feature/domain boundary such as:

```text
src/features/checkin/
  components/
  screens/
  hooks/
  model/
  services/
  utils/
  types/

src/services/supabase/
```

Provide repository/service methods for reference data, check-in create/update/delete, deep-dive relations, history queries and actions/reminders. Reference datasets should be cached and should not refetch on every selection interaction. Preserve platform-agnostic feature logic so future Capacitor integration does not require a rewrite.

Router structure may use React Router. Suggested routes/subroutes:

- `/checkin` → Landing / Create subtab
- `/checkin/emotion`
- `/checkin/unknown`
- `/checkin/:id/secondary-emotions`
- `/checkin/:id/needs`
- `/checkin/:id/contexts`
- `/checkin/:id/review`
- `/checkin/history`
- edit routes may reuse the same screens with an edit mode

Exact route naming may differ if the implementation remains coherent and reload-safe.

## 11. Authentication minimum

The Supabase client foundation already exists. Add only the minimum owner-only sign-in gate required for RLS-backed app use. Do not build public signup UI. Public signup must remain disabled in Supabase once the owner account is created. If no owner user exists yet, the code should still build; document the one manual Dashboard step needed to create/confirm that user.

## 12. Acceptance criteria

The build is accepted only when all of the following are true:

- Landing correctly routes to Emotion or Unknown.
- Emotion is not saved until explicit Save.
- Decision modal appears only after successful persistence.
- Unknown save and Unknown→Emotion conversion reuse the same record and preserve original `created_at`.
- Secondary max 2, Need max 3, Context max 2; max state greys unselected options; removing an item re-enables them.
- Primary emotion cannot be duplicated as secondary.
- Selecting/deselecting does not reset inventory scroll.
- Search includes VN/EN names and descriptions.
- Note persists across Core and all Deep Dive screens.
- Deep Dive screens have only the right-side summary rail, not a redundant top summary.
- Continue saves current step and advances; empty current selection is treated as Skip.
- Quick Save saves current state and ends via the 2-option completion modal.
- Review edits return directly to Review after saving.
- Action modal supports random 3 / refresh / all / custom / none; max 2 linked actions.
- History time scopes and filters work; list always sorts by immutable `created_at DESC`.
- Editing does not reorder History.
- Delete cascades to linked actions/reminders.
- History Color Orb is deterministic, intensity-weighted and hue-clustered.
- `npm run build` and `npm run lint` pass.
- Add targeted automated tests for selection caps, Unknown conversion, immutable ordering behavior and color clustering utility.
- No secret/service-role/database password is committed.


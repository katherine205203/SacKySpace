
# SẮC KÝ v2 — DIARY MODULE PRODUCT, UX & UI IMPLEMENTATION SPECIFICATION v1.0

**Document type:** Product Specification + UX Behavior + UI Implementation Contract  
**Module:** Diary  
**Version:** 1.0  
**Status:** Design baseline for implementation / Codex handoff  
**Desktop priority:** MacBook / 16:10 desktop first  
**Visual system:** Sắc Ký v2 canonical UI system / Soft Editorial Color System  
**Important:** Diary has **no Diary color picker** in this version.

---

# 0. Purpose

Tài liệu này khóa product model, lifecycle, UX behavior, data semantics và visual composition cho Diary v2.

Mục tiêu của Diary là giúp user có một không gian viết theo ngày đủ nhẹ để duy trì lâu dài, nhưng đủ cấu trúc để:
- viết một dòng tự sự chính;
- mở rộng bằng các narrative prompts tùy chọn;
- gắn một cảm xúc chính của ngày;
- liên kết các Check-in cùng ngày với mức độ đại diện riêng;
- lưu tối đa 4 hình ảnh;
- lưu Draft hoặc đánh dấu Done;
- xem lại bằng History, Calendar, Streak và Dashboard;
- viết bù những ngày chưa viết.

Khi có xung đột:
1. Product rules trong tài liệu này thắng mockup sample text.
2. Canonical Sắc Ký UI System thắng legacy Diary CSS/UI.
3. Mockup trong pack là authority cho composition, hierarchy, density và component treatment.
4. Không tự thêm color picker / decorative color choice cho Diary.

---

# 1. Product North Star

Diary không phải một form dài và cũng không phải một rich-text editor phức tạp.

Diary là **one daily journal object** cho mỗi local calendar day:
- có một phần viết chính;
- có thể mở rộng bằng những dòng tự sự tùy chọn;
- có thể gắn context cảm xúc / Check-in / hình ảnh;
- có lifecycle Draft → Done;
- cho phép quay lại chỉnh sửa;
- lịch sử được tổ chức quanh thời gian, continuity và khả năng viết bù.

---

# 2. Locked Product Rules

## 2.1 One Diary per local day
- Mỗi user chỉ có tối đa **1 canonical Diary entry / local calendar day**.
- Không tạo nhiều Diary entry trong cùng ngày.
- Date semantics phải dùng `local_date`, không dùng raw UTC date.

## 2.2 Landing behavior
Khi user vào Diary:
- nếu hôm nay chưa có entry → Empty state;
- nếu hôm nay có Draft → Draft preview/read-like state + CTA **Tiếp tục viết**;
- nếu hôm nay Done → Read-only mode + CTA **Chỉnh sửa**.

## 2.3 Required content
Một Diary entry có:
- **Title** — bắt buộc;
- **Overall** — bắt buộc; plain multiline text;
- **Optional Prompt Responses** — tối đa 6 prompt được chọn từ pool khoảng 9 prompt;
- **Daily Main Emotion** — optional;
- **Attached Check-ins** — optional;
- **Images** — optional, tối đa 4.

## 2.4 No Diary color picker
Diary **không có user-selected color field**.
Không xây:
- color picker;
- Diary accent color selector;
- decorative palette step;
- fallback purple diary color semantics.

Prompt có thể có `emoji` và `hex_color` riêng từ Prompt DB; màu này chỉ dùng như **presentation accent nhẹ** cho prompt card/section.

## 2.5 Draft / Done lifecycle
User có 2 action chính:
- **Save Draft**
- **Mark Done**

Draft:
- vẫn xuất hiện trong History;
- có thể mở lại và hoàn tất;
- không bị coi là Done.

Done:
- chuyển về read mode;
- có thể Edit sau đó;
- Edit một Done Diary **không tự downgrade thành Draft**;
- Save sau Edit cập nhật cùng Done entry.

## 2.6 Delete
User có quyền xóa Draft hoặc Done.
Sau khi xóa:
- local date đó trở về trạng thái “chưa viết”;
- có thể viết lại từ đầu.

## 2.7 Backfill
- User được viết bù một ngày chưa viết.
- Entry point nằm trong **Diary History / Calendar**, không nằm ở Landing hôm nay.
- Backfill Diary ngày X chỉ được attach Check-ins có `local_date = X`.

---

# 3. Canonical Diary Object

Conceptual object:

```text
DiaryEntry
- id
- user_id
- local_date
- status: draft | done | deleted
- title
- overall_text
- daily_emotion_id? 
- daily_emotion_snapshot?
- created_at
- updated_at
- completed_at?
- deleted_at?
```

Related objects:

```text
DiaryPromptResponse
- diary_id
- prompt_id
- prompt_snapshot
- position
- response_text
- is_done
- created_at
- updated_at

DiaryCheckinLink
- diary_id
- checkin_id
- weight_percent
- position
- created_at
- updated_at

DiaryImage
- diary_id
- external_file_id / external_url
- position
- caption?
- metadata
- created_at
```

Field names are recommendations; existing repository/schema naming may differ.

---

# 4. Prompt System

## 4.1 Source
Prompts come from the existing Prompt DB / reference source.

The DB already has a prompt type discriminator used by different modules.  
**Exact field name and exact value for Diary must be verified from the current DB; do not invent or migrate the field solely from this document.**

A Diary prompt supports, where available:
- id/code;
- VN text;
- EN text;
- emoji;
- `hex_color`;
- description;
- active;
- sort_order;
- module/type discriminator.

## 4.2 Selection
- Pool baseline: ~9 Diary prompts.
- User may choose **0–6 prompts**.
- User determines selection order.
- Selected order is preserved.

## 4.3 Prompt response
Each selected prompt becomes a sub-content section:
- prompt identity;
- emoji;
- optional subtle accent based on prompt `hex_color`;
- plain multiline response;
- small **Done/tick** control;
- remove/unselect action.

Prompt `is_done` is a **personal progress cue**, not a validation gate.

Diary may be marked Done even when:
- a selected prompt is not ticked Done;
- a prompt response is empty.

## 4.4 Removing a written prompt
If response text exists and user tries to remove the prompt:
- ask for confirmation;
- do not silently delete the content.

---

# 5. Title & Overall

## Title
- required;
- plain text;
- max recommended length: **120 characters**;
- no minimum other than trimmed non-empty.

## Overall
- required;
- plain multiline text;
- no minimum character count other than `trim().length > 0`;
- no rich text toolbar;
- no mandatory formatting.

Draft/autosave must never clear Title or Overall due to re-render/navigation.

---

# 6. Daily Main Emotion

- Optional.
- User may choose exactly **0 or 1** emotion.
- Uses the same canonical Emotion reference set as Check-in (117 emotions).
- No intensity for Diary daily emotion.
- Daily emotion may coexist with attached Check-ins.
- Selecting a Daily Emotion does not mutate Check-in data.
- If emotion reference changes later, historical Diary should preserve enough snapshot/presentation data to remain stable.

---

# 7. Attached Check-ins

## 7.1 Eligibility
Only Check-ins with the same Diary `local_date` can be attached.

## 7.2 Multiple attachments
- Multiple same-day Check-ins may be attached.
- Unknown Check-ins are allowed.

If multiple Unknown Check-ins exist on the same day, picker must show enough differentiation:
- “Mình còn đang mơ hồ”
- brief note/summary
- time

## 7.3 Weight
Each attached Check-in has an independent slider:
- 0–100%;
- effective attached value should be >0;
- values **do not need to sum to 100%**.

Example:
- Morning Check-in: 40%
- Midday Check-in: 65%
- Evening Check-in: 25%

This is valid.

Weight means:
> “Mức độ user thấy Check-in này đại diện/ảnh hưởng tới Diary của ngày.”

Weight must **not** change:
- Check-in intensity;
- Home Orb;
- Check-in History Orb;
- Check-in aggregate calculation.

---

# 8. Images

- Max **4 images / Diary**.
- Image only for v1.
- Support:
  - add;
  - remove;
  - replace;
  - reorder;
  - optional caption.

## Storage decision
Do **not** design around Supabase Storage as the intended media store.

User will provide a Google Drive location/link for image storage.  
Exact Google Drive auth/upload/folder integration remains implementation-dependent until that location/access mechanism is provided.

The application should store stable external identifiers/URLs/metadata needed to reconstruct the Diary.

---

# 9. Diary Lifecycle

```text
NO_ENTRY
  |
  +--> DRAFT
  |     |
  |     +--> DRAFT (autosave / Save Draft)
  |     |
  |     +--> DONE
  |
  +--> DONE

DONE
  |
  +--> EDITING_DONE
          |
          +--> DONE

DRAFT / DONE
  |
  +--> DELETED
          |
          +--> date becomes available for new Diary
```

Backfill follows the same lifecycle but with a historical `local_date`.

---

# 10. Streak & Dashboard

Diary may expose baseline dashboard metrics:

- Current Diary streak
- Longest Diary streak
- Total Done Diary entries in selected month/range
- Draft count
- Optional completion ratio later

## Streak semantics
Recommended v1:
- a local day counts as a Diary streak day when the Diary is **Done**;
- Draft does not count as completed streak;
- writing backfill can recompute historical continuity if product wants historical truth.

Implementation must use one shared Diary streak capability; Home/History must not calculate different formulas.

---

# 11. Information Architecture

```text
DIARY
|
+-- Today Landing
|   +-- Empty
|   +-- Draft Preview
|   +-- Done Read Mode
|
+-- Editor
|   +-- Title
|   +-- Overall
|   +-- Prompt selection
|   +-- Prompt responses
|   +-- Daily Emotion
|   +-- Same-day Check-ins + weights
|   +-- Images
|   +-- Save Draft
|   +-- Mark Done
|
+-- History
    +-- Dashboard / Streak
    +-- Calendar
    +-- Draft / Done / Missing day states
    +-- Backfill
    +-- Editorial list/timeline
    +-- Diary Detail / Read
    +-- Edit / Delete
```

---

# 12. Visual System

Diary must remain visibly part of the same Sắc Ký app as Home and Check-in.

## Visual principles
- Soft Editorial Color System.
- White/light surfaces over the canonical Sắc Ký canvas.
- Violet is product accent, not a full-screen tint.
- Prompt hex colors are content accents only.
- Use spacing and typography before adding containers.
- Avoid nested cards where separators are sufficient.
- No Diary color picker.
- No mascot dependency.
- No heavy SaaS analytics dashboard aesthetic.
- Images should feel editorial, not like an asset-management system.

## Prompt color usage
Prompt `hex_color` may appear as:
- icon/emoji halo;
- 1px border tint;
- very light surface wash;
- small accent label/tick.

Do not:
- fill the whole page with prompt color;
- make every prompt section highly saturated;
- override semantic CTA colors with prompt colors.

---

# 13. Screen Specifications

## SCREEN D01 — Landing / Empty Today

Purpose:
- user has not written today;
- invite writing without pressure;
- show continuity metrics;
- provide History access.

Required:
- “Nhật ký hôm nay”
- current streak / longest streak / monthly count
- one primary empty-state hero
- CTA “Bắt đầu viết”
- History CTA

Optional lightweight prompt inspiration may appear as supporting content, not as mandatory form fields.

## SCREEN D02 — Landing / Draft Today

Required:
- Draft badge
- date
- title preview
- Overall excerpt
- selected prompt summary
- attachment summary
- CTA “Tiếp tục viết”
- History CTA
- draft autosave cue

## SCREEN D03 — Landing / Done Read Mode

Required:
- date
- Done state
- title
- full Overall
- prompt responses
- Daily Emotion if selected
- Check-ins + percentages if attached
- images
- Edit CTA
- History CTA

No edit controls in read mode except page-level “Chỉnh sửa” / management controls.

## SCREEN D04 — Core Editor

Required:
- date context
- Title *
- Overall *
- prompt area
- attachment entry points
- Save Draft
- Mark Done
- autosave feedback

No rich text editor.

## SCREEN D05 — Prompt Selection

Required:
- show active Diary prompt pool
- max 6 selected
- counter X/6
- emoji
- prompt title/text
- selected state
- optional prompt hex accent
- user-controlled order
- Done CTA

## SCREEN D06 — Prompt Response Editor

Each selected prompt:
- emoji
- prompt text
- multiline response
- Done/tick
- remove
- color accent derived from prompt hex
- preserves user selection order

## SCREEN D07 — Daily Emotion + Check-in Attachments

Daily emotion:
- 0–1 from canonical 117 emotion set
- no intensity

Check-ins:
- same-day only
- multiple allowed
- each has independent 0–100 slider
- no total=100 validation

The two features can be used at the same time.

## SCREEN D08 — Image Manager

Required:
- 0–4 images
- reorder
- caption optional
- replace
- delete
- clear 4/4 limit state

Storage UI must not imply Supabase Storage specifically.

## SCREEN D09 — History Calendar + Dashboard

Required:
- month navigation
- current streak
- longest streak
- Done count
- Draft count
- calendar day states:
  - Done
  - Draft
  - Not written
- selecting a missing historical day exposes “Viết bù”
- selecting Draft exposes “Tiếp tục”
- selecting Done exposes “Xem lại”

## SCREEN D10 — History Editorial Timeline / Detail

Recommended desktop structure:
- left: Diary list/timeline
- right: selected Diary read detail

Filters:
- All
- Done
- Draft
- month/range

Detail can show:
- status
- title
- date
- Daily Emotion
- Overall
- prompts
- images
- attached Check-ins

---

# 14. Home Integration Contract

Home “Nhật ký hôm nay” reads the same canonical Diary object.

States:

## No entry
- brief empty message
- CTA to write today

## Draft
- title/excerpt
- Draft state
- CTA “Tiếp tục viết”

## Done
- title/excerpt
- Done state
- CTA “Xem nhật ký”

Home must not create a separate Diary copy.

---

# 15. Draft Persistence

This is a critical acceptance area.

Diary must not lose:
- Title;
- Overall;
- prompt selection;
- prompt text;
- prompt Done state;
- Daily Emotion;
- Check-in links/weights;
- image metadata/captions

because of:
- re-render;
- route change within Diary;
- opening/closing modal;
- prompt selection;
- attachment flow;
- browser reload where persistence architecture supports recovery.

Recommended:
- debounced local safety cache;
- authenticated server draft canonical record.

Exact architecture may follow existing app patterns, but product behavior is non-negotiable: user-entered valid text must not disappear unexpectedly.

---

# 16. History / Backfill Behavior

Calendar is the primary navigation aid for historical writing.

For a selected day:

### Done
- View
- Edit
- Delete

### Draft
- Continue
- Delete

### Not written
- Write Backfill

Backfill editor must clearly show the historical date to avoid user believing they are writing today.

Backfill attachments:
- Daily Emotion may be selected normally.
- Check-in picker only uses Check-ins from the backfill date.
- Images follow standard max 4.

---

# 17. Delete Semantics

Delete requires confirmation.

Deleting Diary:
- does not delete Check-ins;
- does not delete canonical Emotion references;
- does not delete unrelated external image files unless the image-storage product rule explicitly supports file deletion;
- removes/unlinks Diary-specific relations according to implementation semantics.

After delete:
- day becomes “Not written”;
- user may write again.

---

# 18. Responsive Behavior

## Desktop / MacBook
Primary target.
- content max-width consistent with Home;
- optional right rail for editor summary;
- history supports calendar + detail or timeline + detail.

## Intermediate desktop
- do not squeeze editor/read rails until content becomes unreadable;
- collapse to stacked layout at an appropriate content breakpoint.

## Mobile
- single-column;
- summary rail becomes inline/collapsible;
- prompt cards become 1 column or compact 2 column where readable;
- sliders remain touch-friendly;
- image grid becomes 1–2 columns;
- sticky Save Draft / Done action region may be used if it does not cover text fields.

---

# 19. Accessibility

- selected prompt/emotion states cannot depend only on color;
- prompt hex accent must have non-color selected cue;
- visible focus;
- keyboard operability on desktop;
- touch targets sufficient on mobile;
- multiline fields must have labels;
- image caption inputs accessible;
- status Draft/Done includes text, not just color;
- reduced-motion respected.

---

# 20. Acceptance Criteria

## Core
- [ ] Exactly one Diary entry per user/local_date.
- [ ] Title required.
- [ ] Overall required.
- [ ] Plain multiline only.
- [ ] No Diary color picker.
- [ ] Save Draft works.
- [ ] Mark Done works.
- [ ] Done Edit stays Done after save.
- [ ] Delete makes date writable again.

## Prompts
- [ ] Pool comes from existing Prompt reference source.
- [ ] Up to 6 selected.
- [ ] User selection order preserved.
- [ ] Emoji shown.
- [ ] Prompt hex may be used as subtle accent.
- [ ] Per-prompt Done/tick supported.
- [ ] Prompt Done not required for Diary Done.
- [ ] Removing written prompt asks confirmation.

## Emotion / Check-in
- [ ] Daily Emotion optional, max 1.
- [ ] Attached Check-ins optional and can coexist with Daily Emotion.
- [ ] Same local date only.
- [ ] Unknown Check-ins attachable.
- [ ] Weight sliders independent.
- [ ] Weights do not need to sum 100%.
- [ ] Diary weights do not alter Check-in/Orb semantics.

## Media
- [ ] Max 4 images.
- [ ] Reorder.
- [ ] Replace.
- [ ] Delete.
- [ ] Optional caption.
- [ ] Media architecture does not assume Supabase Storage as final store.

## History
- [ ] Draft visible.
- [ ] Done visible.
- [ ] Missing days identifiable.
- [ ] Historical missing date supports Write Backfill.
- [ ] Draft supports Continue.
- [ ] Done supports Read/Edit.
- [ ] Streak/dashboard use shared semantics.

## Persistence
- [ ] User input does not disappear on ordinary re-render/navigation.
- [ ] Draft can be resumed.

---

# 21. Suggested Implementation Slices

### Slice 1 — Canonical Diary + Today Landing
- one-entry-per-day constraint/service rule
- Empty / Draft / Done states
- Title + Overall
- Draft persistence

### Slice 2 — Prompt Backbone
- existing Prompt DB query
- Diary-type filtering
- selection max 6
- selected order
- prompt response + Done state

### Slice 3 — Daily Emotion + Check-in Links
- 117 Emotion picker
- same-day Check-in query
- independent weights
- Unknown differentiation

### Slice 4 — Media
- image metadata object
- max 4
- reorder/caption/replace/remove
- external storage integration boundary

### Slice 5 — Read Mode / Edit / Delete
- canonical read
- Edit Done semantics
- Delete

### Slice 6 — History
- calendar
- Dashboard/Streak
- Draft/Done/Missing
- backfill
- editorial list/detail

### Slice 7 — Home Integration + Hardening
- Today Diary Home card
- responsive
- accessibility
- persistence/error recovery
- visual regression

---

# 22. Mockup Authority

The mockups included in this document are approved **directional composition references**.

They lock:
- high-level layout;
- hierarchy;
- density;
- editorial feeling;
- prompt treatment;
- attachment treatment;
- image management treatment;
- History/calendar direction.

They do not override:
- actual reference data;
- existing database field names;
- auth/security;
- exact Prompt DB type field naming;
- final Google Drive storage integration details.

Codex should reuse existing domain/repository code where correct, but may replace the Diary presentation layer to match this specification.

---

# 23. Definition of Done

Diary v2 baseline is complete when:

1. Today Landing has Empty, Draft and Done states.
2. One Diary/local_date is enforced.
3. Title + Overall are required and persistent.
4. Prompt selection max 6 and response editor work end-to-end.
5. Daily Emotion and same-day Check-in attachments work simultaneously.
6. Check-in percentages are independent and do not require 100%.
7. Up to 4 images are manageable.
8. Draft and Done lifecycle works.
9. History shows Done, Draft and Missing days.
10. Historical Write Backfill works.
11. Streak/Dashboard work with one shared rule.
12. Home reads the canonical Diary.
13. No Diary color picker exists.
14. Desktop MacBook visual composition matches the approved mockup direction.
15. Lint/tests/build and authenticated browser acceptance pass.

**END — SẮC KÝ v2 DIARY MODULE v1.0**

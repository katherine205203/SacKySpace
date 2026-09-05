# SẮC KÝ v2 — ACTION SPACE UPDATE HANDOFF
## v1.0 — Personal Action Stream + Contextual Dashboard + Action History

**Scope:** Action Space · Light Theme · Desktop-first  
**Repo:** `katherine205203/SacKySpace`  
**Primary reference:** UI Pack `AS01 → AS09`  
**Target:** Codex implementation handoff

---

# 1. PRODUCT DIRECTION

Action Space is **not a productivity dashboard** and not a generic to-do app.

Canonical concept:

> **Action Space = Personal Action Stream**
>
> A place where small actions are captured, scheduled, completed, and closed with a reflection.

Core lifecycle:

`Capture → Plan → Do → Reflect`

The main screen is action-first.  
Analytics are secondary and live in the **right rail**, not across the top of the page.

Remove the previous dashboard-heavy direction:
- no large KPI strip above the action list;
- no “Những bước từng giúp” block;
- no “Gợi ý cho hôm nay” block;
- no motivational quote panel;
- no gamified productivity dashboard treatment.

---

# 2. MAIN INFORMATION ARCHITECTURE

Action Space has two main surfaces:

```text
Action Space
├── Main Action Stream
│   ├── Hôm nay
│   ├── Sắp tới
│   ├── Quá hạn
│   ├── Chưa lên lịch
│   └── Đã hoàn thành
│
└── History
    ├── Timeline
    ├── Calendar / Theo ngày
    └── Reflection Lens
```

No new root sidebar module is required.

`History` is a secondary entry inside Action Space.

---

# 3. ACTION DATA / CARD RULES

Every Action card must include:

1. **Emoji**
   - From Check-in → use real source emotion emoji.
   - Independent → use `✨`.

2. **Title**

3. **Full description**
   - Action Space is allowed to show full description.
   - Do not truncate aggressively unless necessary for responsive layout.

4. **Quick Done control**

5. **Source badge**
   - Independent → `Độc lập`
   - From Check-in → `Từ Check-in · [emotion_name_vn]`

6. **Source color treatment**
   - From Check-in → use real `hex_color`.
   - Independent → use Sắc Ký global violet.

7. **Schedule metadata**
   - date / time / unscheduled state as applicable.

The source color should affect:
- emoji tile tint,
- subtle edge/accent,
- badge tint,
- Done control accent.

Do not reduce source identity to a tiny generic dot only.

---

# 4. MAIN ACTION SPACE SCREEN

Canonical main layout:

```text
Header
Action Space
Short supporting copy
[+ Viết action] [Lịch sử]

Tabs
Hôm nay · Sắp tới · Quá hạn · Chưa lên lịch · Đã hoàn thành

Main column
Action stream

Right rail
Contextual dashboard
```

Do not place 4 KPI cards above the action stream.

The user should enter Action Space and immediately see actions.

---

# 5. RIGHT RAIL — CONTEXTUAL DASHBOARD

The right rail **can be a dashboard**.

However, it must be contextual, lightweight, and secondary to the action list.

## 5.1 Default state — no Action selected

Example for `Hôm nay`:

### Hôm nay
- number waiting
- number completed

### Nhịp 7 ngày
Simple 7-day dots / lightweight activity strip.

### Theo nguồn
- Từ Check-in
- Độc lập

No recommendation engine.
No quote.
No “things that helped you”.
No AI insight.

## 5.2 When Action is selected

The same rail transforms into:

`Action Detail`

Close detail → contextual dashboard returns.

This pattern is canonical.

---

# 6. TAB BEHAVIOR

Main tabs:

- `Hôm nay`
- `Sắp tới`
- `Quá hạn`
- `Chưa lên lịch`
- `Đã hoàn thành`

## Hôm nay
Actions scheduled for today.

## Sắp tới
Future scheduled actions.

## Quá hạn
Scheduled actions past due and not completed.

## Chưa lên lịch
A true backlog.

These are actions the user wants to keep but has not committed to a date/time.

Do not treat this as a minor edge state.

## Đã hoàn thành
Completed action stream with Reflection attached.

Do not use ugly strike-through as the main completed treatment.

---

# 7. UNSCHEDULED / BACKLOG

`Chưa lên lịch` should feel intentional, not broken.

User can:
- leave an Action unscheduled;
- schedule later;
- edit;
- delete;
- open detail.

Do not force every action onto a calendar.

This supports Sắc Ký's low-pressure product philosophy.

---

# 8. COMPLETED ACTIONS

Completed Actions remain readable.

A completed card should show:
- emoji;
- title;
- source;
- completed time;
- Reflection result;
- optional Reflection note.

Do not collapse it into a crossed-out task row.

Completed state is part of the user's personal record.

---

# 9. REFLECTION

Reflection opens immediately after Done.

Exact question:

**“Làm xong, bạn thấy thế nào rồi?”**

Exact 5 options:

1. `Ổn hơn`
2. `Thoải mái / thông suốt hơn nhiều`
3. `Không có gì khác biệt`
4. `Tệ hơn`
5. `Khác`

Do not rewrite or shorten these labels.

Reflection supports:
- one selected outcome;
- optional note;
- `Bỏ qua`;
- `Lưu lại`.

The goal is quick reflection, not a survey.

---

# 10. ACTION DETAIL RIGHT RAIL

Action Detail opens in the right rail rather than navigating away.

Show:

- emoji;
- title;
- full description;
- source badge;
- source Check-in quick-view/link if applicable;
- schedule;
- time;
- reminder if supported;
- recurrence if supported;
- current status;
- Reflection if completed.

Actions:
- Edit
- Done / Mark complete
- Reschedule
- Delete

Do not duplicate the entire main card inside the rail.

---

# 11. CREATE / EDIT ACTION

Use a modal.

Fields:

- Emoji/source identity
- Title
- Description
- Source
  - Independent
  - From Check-in
- Schedule
  - Hôm nay
  - Ngày cụ thể
  - Chưa lên lịch
- Time optional
- Recurrence allowed
- Reminder/notification separated if supported

No calendar-heavy planning surface.

Keep it compact and clear.

---

# 12. ACTION HISTORY

History is a real product surface, not just the `Đã hoàn thành` tab.

It lets the user read Actions from different lenses.

Canonical 3 views:

1. **Timeline**
2. **Calendar / Theo ngày**
3. **Reflection Lens**

---

# 13. HISTORY — TIMELINE

Default History view.

Grouped by day.

Each record:
- time;
- emoji;
- title;
- source;
- Reflection;
- optional short Reflection note.

Filters:
- date range;
- source;
- emotion/source Check-in;
- Reflection outcome.

This view answers:

> “Mình đã làm gì, và sau đó mình thấy thế nào?”

---

# 14. HISTORY — CALENDAR / THEO NGÀY

Desktop split:

- calendar/date selector;
- selected-day action records.

User can:
- click a date;
- view actions completed that day;
- see Reflection result;
- move between days/months.

This should connect naturally to Diary / Day Record later.

Do not turn this into a scheduling calendar.

It is a **history lens**, not a planner.

---

# 15. HISTORY — REFLECTION LENS

Reflection Lens lets the user read completed Actions by outcome.

Top filter uses the exact 5 Reflection values:

- Ổn hơn
- Thoải mái / thông suốt hơn nhiều
- Không có gì khác biệt
- Tệ hơn
- Khác

Example:
Select `Ổn hơn`
→ show all Actions that ended with `Ổn hơn`.

Additional filters:
- date range;
- source;
- source emotion.

No AI conclusion such as:
“Walking works best for you.”

This is factual filtering only.

---

# 16. ACTION CHAIN / PROVENANCE

If an Action comes from Check-in, preserve the relationship:

```text
Check-in
↓
Action
↓
Reflection
```

Example:

`Mệt mỏi → Đi bộ 10 phút → Ổn hơn`

This relationship should be available in:
- Action Detail;
- History;
- Day Record / Diary integration.

Do not flatten source provenance into plain text only.

---

# 17. VISUAL SYSTEM

Follow current Sắc Ký Light Theme exactly.

- canvas `#F8F6FF`
- surface `#FFFFFF`
- ink `#231B46`
- muted `#625A75`
- violet `#743CFF`
- strong violet `#5326BE`
- soft violet `#ECE4FF`
- border `#E5DDF5`
- font: **Be Vietnam Pro**

Primary CTA:
solid `#743CFF` + white.

Visual direction:
- clean;
- editorial;
- vivid;
- warm;
- young;
- no SaaS-heavy dashboard;
- no glassmorphism;
- no excessive card-inside-card;
- no muted gray UI that kills source emotion colors.

---

# 18. CANONICAL SCREEN MASTER LIST

## AS01 — Action Space / Today
Main canonical Action Space.

- `Hôm nay` active
- action stream
- right rail contextual dashboard

## AS02 — Action Space / Unscheduled
Backlog view.

- `Chưa lên lịch` active
- schedule later actions
- no pressure to commit

## AS03 — Action Space / Completed
Completed action stream.

- Reflection visible
- right rail contextual completed/reflection summary

## AS04 — Action Detail / Right Rail
Selected Action detail in rail.

## AS05 — Create / Edit Action Modal
Create/edit Action.

## AS06 — Reflection Modal
Done → Reflection.

## AS07 — Action History / Timeline
History grouped chronologically.

## AS08 — Action History / Calendar
Calendar/date lens.

## AS09 — Action History / Reflection Lens
Filter history by Reflection outcome.

---

# 19. REFERENCE UI PACK

Use the supplied AS01–AS09 PNGs as visual direction.

Important:
- each screen is an independent reference;
- do not combine them into a collage in implementation;
- product rules in this handoff override any accidental mockup text/detail mismatch.

Expected file names:

- `AS01_Action_Space_Today.png`
- `AS02_Action_Space_Unscheduled.png`
- `AS03_Action_Space_Completed.png`
- `AS04_Action_Detail_Right_Rail.png`
- `AS05_Create_Edit_Action_Modal.png`
- `AS06_Reflection_Modal.png`
- `AS07_Action_History_Timeline.png`
- `AS08_Action_History_Calendar.png`
- `AS09_Action_History_Reflection_Lens.png`

---

# 20. HARD ACCEPTANCE

Do not mark Done merely because lint/build pass.

Acceptance:

1. No KPI dashboard strip above the main action list.
2. No “Những bước từng giúp”.
3. No “Gợi ý hôm nay”.
4. Main list is the visual focus.
5. Right rail dashboard is contextual and secondary.
6. Right rail switches to Action Detail when an Action is selected.
7. Cards contain correct emoji/source/title/full description/Done/color.
8. `Chưa lên lịch` works as a real backlog.
9. Completed Actions preserve Reflection.
10. Reflection modal uses exact locked wording/options.
11. History supports Timeline / Calendar / Reflection Lens.
12. Source Check-in provenance remains available.
13. Existing AppShell/theme/font remain unchanged.
14. No visual regression to Home / Diary / Check-in.

---

# 21. REQUIRED SCREENSHOT ACCEPTANCE

Capture authenticated desktop screenshots at the same viewport:

1. AS01 Today
2. AS02 Unscheduled
3. AS03 Completed
4. AS04 Detail rail
5. AS05 Create/Edit modal
6. AS06 Reflection modal
7. AS07 Timeline History
8. AS08 Calendar History
9. AS09 Reflection Lens

Also capture one current Home screen to confirm no AppShell/theme regression.

Run:
- lint
- relevant tests
- build

Then:

`IMPLEMENT → VERIFY → CAPTURE → STOP → OWNER REVIEW`

Do not commit / push / deploy before approval.

---

# FINAL LOCK

**Action Space = Personal Action Stream, not a productivity dashboard.**

Main canvas:
**actions**

Right rail:
**context / detail**

History:
**read the past by time, day, or Reflection**

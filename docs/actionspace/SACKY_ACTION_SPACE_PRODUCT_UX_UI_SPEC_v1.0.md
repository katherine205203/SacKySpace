
# SẮC KÝ v2 — ACTION SPACE
## Product, UX & UI Implementation Specification v1.0

**Document type:** Product Specification + UX Behavior + UI Implementation Contract  
**Module name:** Action Space  
**Replaces UI label:** Reminder  
**Version:** 1.0  
**Status:** Build baseline / Codex handoff  
**Desktop priority:** MacBook / 16:10 first  
**Visual system:** Sắc Ký v2 canonical UI system / Soft Editorial Color System  

---

# 0. Purpose

Action Space là nơi biến điều user vừa nhận ra thành một bước nhỏ có thể làm, đặt bước đó vào thời gian nếu muốn, rồi nhìn lại xem sau khi làm xong user thực sự cảm thấy thế nào.

North Star:

> **Capture → Plan → Reflect**

Action Space không phải productivity/task-management suite.  
Không tối ưu cho:
- priority matrix;
- projects;
- productivity score;
- leaderboard;
- deadline pressure;
- gamification kiểu XP/coin.

Nó tối ưu cho:

> “Mình nhận ra điều gì → mình muốn làm gì với nó → mình đã làm chưa → làm xong mình thấy thế nào?”

---

# 1. Locked Product Decisions

## 1.1 Module naming
- Navigation label: **Action Space**
- Home có thể tiếp tục dùng section label thân thiện như **Việc cần làm**.
- Không dùng “Reminder” làm product concept chính nữa.

## 1.2 Canonical Action
Tất cả Action trong Sắc Ký là cùng một canonical object, bất kể được tạo từ:
- Check-in suggested Action;
- Check-in custom Action;
- Action Space user-created Action.

Không tồn tại “Check-in action object” riêng và “Reminder action object” riêng.

## 1.3 Minimum fields
**Required**
- Title

**Optional**
- Description / Note
- Schedule
- Exact time
- Current linked Check-in

## 1.4 Unscheduled is valid
Action được phép tồn tại hoàn toàn không có schedule.

Unscheduled Action đi vào bucket:
- **Chưa lên lịch**

## 1.5 Main workspace tabs
Action Space v1 có 5 tab:

1. **Hôm nay**
2. **Upcoming**
3. **Quá hạn**
4. **Chưa lên lịch**
5. **Đã hoàn thành**

## 1.6 Upcoming grouping
Upcoming group theo:
- Ngày mai
- Tuần này
- Sau đó

Không cần arbitrary 30-day cutoff; tất cả future scheduled Action có thể xuất hiện.

## 1.7 Date range
Action có thể:
- unscheduled;
- một ngày;
- date range;
- optional exact time.

Date-range Action là **một canonical row**, không duplicate thành nhiều Action cho từng ngày.

## 1.8 Notification
Notification là capability riêng và **không thuộc v1**.

V1 chỉ lưu schedule/time để:
- hiển thị;
- phân nhóm;
- xác định overdue.

Không giả vờ gửi notification.

## 1.9 Recurrence
Không build recurrence trong v1.

Schema/domain model nên tránh thiết kế chặn khả năng thêm recurrence sau này.

## 1.10 No priority / project/category
Không có:
- High / Medium / Low;
- Eisenhower;
- project;
- folder;
- workstream;
- category taxonomy.

Action Space không biến thành project manager.

## 1.11 Check-in linkage
- 1 Action có tối đa **1 current linked Check-in**.
- 1 Check-in có tối đa **2 active linked Actions**.
- Action được phép link / unlink / đổi sang Check-in khác.
- User-created Action có thể link Check-in sau khi đã tạo.
- Picker ưu tiên recent Check-ins, nhưng có thể tìm older Check-ins.

## 1.12 Origin is immutable
Ví dụ:

```text
origin_type = user_created
current_linked_checkin_id = CI_123
```

Việc link Check-in sau đó không đổi origin.

Tương tự Action sinh từ Check-in nhưng sau này unlink:
- origin vẫn là `checkin`;
- current linkage có thể null.

## 1.13 Action color semantics
Nếu đang linked với Check-in:
- visual accent lấy từ Check-in `color_hex`;
- dùng nhẹ: left rail, dot, icon halo, tiny badge;
- không fill toàn card.

Nếu không có current Check-in:
- dùng Action Space independent accent: teal/neutral canonical treatment.

## 1.14 Done
Bấm Done ở bất kỳ nơi nào:
- Action Space;
- Home;
- Check-in Detail;
- nơi khác có canonical Action control;

thì phải:
1. cập nhật Action thành Done ngay;
2. chạy rewarding micro-animation;
3. **mở Reflection popup ngay lập tức, luôn luôn**.

Reflection optional ở mức user có thể Skip, nhưng popup luôn xuất hiện.

## 1.15 Reflection
Reflection chỉ hỏi đúng một câu:

> **“Làm xong, bạn thấy thế nào rồi?”**

Có:
- một outcome option;
- optional note.

Outcome set lấy từ reference/Admin Studio, không hardcode nếu reference đã tồn tại.

## 1.16 Undo / redo
User có thể:
- Done;
- Undone;
- Done lại.

Undone:
- không xóa historical reflection cycle cũ.

Done lần sau:
- mở Reflection lại;
- tạo completion/reflection cycle mới;
- có thể prefill outcome/note gần nhất nếu implementation hiện tại đã hỗ trợ, nhưng user phải chủ động xác nhận/lưu cycle mới.

## 1.17 Edit Done
Edit một Action đã Done:
- không tự reopen;
- Save giữ Done.
- Chỉ “Đánh dấu chưa xong” mới đổi status.

## 1.18 Delete
Delete Action = **hard delete product semantics**.

Xóa sạch:
- Action;
- current linkage;
- completion history;
- reflection history của Action.

Không để Action đó trong archive/trash của UI.

Check-in liên quan vẫn tồn tại.

---

# 2. Product Architecture: Capture → Plan → Reflect

## 2.1 Capture

Mục tiêu:
- ghi nhanh điều user muốn làm;
- friction thấp;
- không bắt schedule.

**Important UI lock:**  
**Create Action là MODAL. Không có Create Action full-page route trong v1.**

Create Action Modal gồm:
- Title *
- Description optional
- Schedule optional
- Link Check-in optional
- Primary CTA “Thêm action”

Có thể tạo Action unscheduled chỉ với Title.

## 2.2 Plan

Plan không phải project planning.

Plan chỉ là:
- khi nào;
- trong khoảng ngày nào;
- exact time nếu muốn;
- current Check-in linkage nếu muốn.

Action có thể plan:
- ngay khi create;
- sau create từ Chưa lên lịch;
- từ Action Detail/Edit.

## 2.3 Reflect

Done không phải điểm kết thúc im lặng.

Sau Done:
- animation;
- Reflection popup;
- outcome;
- optional note;
- user Skip hoặc Save.

Reflection tạo feedback loop để về sau Action Space có thể trả lời:

> “Những bước nào từng thực sự giúp mình?”

---

# 3. Conceptual Data Model

Field names dưới đây là conceptual contract. Codex phải reuse/map schema hiện có khi phù hợp.

## 3.1 Action

```text
Action
- id
- user_id
- title
- description?
- status: active | done
- origin_type: user_created | checkin_suggested | checkin_custom | ...
- origin_ref_id?
- current_linked_checkin_id?
- schedule_type: none | date | date_range
- start_local_date?
- end_local_date?
- exact_local_time?
- created_at
- updated_at
- completed_at?
```

Existing DB table may still be named `reminders`.  
V1 does **not** require risky database rename if current data works.

Semantic layer/UI should use **Action**.

## 3.2 Completion cycle

```text
ActionCompletionCycle
- id
- action_id
- completed_at
- reopened_at?
- cycle_number
```

## 3.3 Reflection

```text
ActionReflection
- id
- action_id
- completion_cycle_id
- outcome_id
- outcome_snapshot?
- note?
- created_at
- updated_at
```

## 3.4 Link semantics

Current link may be stored:
- directly on Action; or
- through a linkage table.

Implementation may follow existing architecture.

Product invariants:
- Action max 1 current Check-in.
- Check-in max 2 active Actions.

---

# 4. Time Semantics

## 4.1 Unscheduled
No date/time.

Appears:
- Chưa lên lịch.

## 4.2 One-day
`start_local_date = end_local_date` or single-date representation.

If date = today:
- Hôm nay.

If future:
- Upcoming.

If past + active:
- Quá hạn.

## 4.3 Date range
One Action, one row.

For today:
- appears in Hôm nay if today ∈ [start, end].

Future range:
- Upcoming based on start/range presentation.

Overdue:
- after end date passes and Action remains active.

## 4.4 Exact time
Optional.

Exact time only refines display/order; Action remains valid without it.

## 4.5 Sort recommendation

### Today
1. timed Action ascending
2. untimed scheduled-today
3. date-range active today

### Upcoming
group first, then:
- date ascending;
- time ascending;
- created_at as stable tie-break.

### Overdue
oldest due first or most recent overdue first can be a config choice; default recommended:
- most recently overdue first to reduce overwhelming backlog.

### Unscheduled
created_at DESC.

### Completed
completed_at DESC.

---

# 5. Main Action Space Workspace

## 5.1 Header
- Title: Action Space
- Supporting sentence
- CTA: **+ Thêm action**

## 5.2 Lightweight dashboard
Recommended 4 metrics max:

- Cần làm hôm nay
- Đã làm tuần này
- Nhịp hành động
- Những bước từng giúp

Do not add KPI overload.

## 5.3 Tabs
One shared tab surface:
- Hôm nay
- Upcoming
- Quá hạn
- Chưa lên lịch
- Đã hoàn thành

## 5.4 Right rail
Right rail changes by active tab:
- Today: Nhịp hành động, Small Wins, reflection pattern
- Upcoming: future summary + rhythm
- Overdue: gentle rescheduling support
- Unscheduled: Capture/Plan explanation
- Completed: wins + reflection outcome summary

Right rail must stay supportive, not dominant.

---

# 6. Action Card Anatomy

Canonical card:

```text
[source color rail/dot] [icon/emoji]

Title
Description/Note excerpt

[origin / linked Check-in badge]

Schedule/date/time                [Done] [⋯]
```

## 6.1 Linked Action
Visual accent uses current Check-in hex.

Example:
- left rail = `checkin.color_hex`
- dot = same
- small halo = derived tint
- linked badge can reference emotion/check-in

## 6.2 Independent Action
Use canonical Action accent:
- teal/neutral;
- no fake emotion color.

## 6.3 No giant cards
Action list should be compact enough to scan:
- not kanban;
- not large inspirational tiles.

---

# 7. Create Action Modal — Canonical Creation Surface

**LOCK:** Create Action is a modal.

Do not create `/action/new` full page unless needed only as internal fallback route invisible to normal UX.

## 7.1 Modal fields

### Required
- “Bạn muốn làm gì?” / Title

### Optional
- Note / Description

### Schedule block
Quick choices:
- Chưa lên lịch
- Hôm nay
- Ngày mai
- Chọn ngày

Advanced when opened:
- one day
- date range
- exact time optional

### Link Check-in
- optional
- current linked Check-in preview
- choose/change/unlink

## 7.2 Modal behavior
- default focus Title
- Escape closes if safe
- if user entered content and closes: confirm/discard or preserve local temporary draft according to existing modal pattern
- no nested modal stack if possible

Check-in picker can replace modal content / open side panel rather than modal-on-modal.

## 7.3 CTA
- Cancel/Để sau
- Thêm action

Creating unscheduled Action is fully valid.

---

# 8. Link Check-in Picker

## 8.1 Eligibility
Any user Check-in may be linked unless business constraints disallow.

Picker defaults:
- recent 7–30 days
- search
- older history access

## 8.2 Card content
For Emotion Check-in:
- emoji
- VN name
- EN name if space allows
- local date/time
- brief note
- color accent

For Unknown:
- “Mình còn đang mơ hồ”
- brief note/summary
- local time

## 8.3 Selection
- max 1
- selected border/tint uses Check-in color hex
- non-color cue required
- item does not reorder when selected

## 8.4 Limit enforcement
If target Check-in already has 2 active Actions:
- disable link
- explain limit clearly
- do not silently unlink another Action.

---

# 9. Action Detail Drawer

Action opens in a right-side drawer/panel on desktop.

Content:
- title
- full description
- status
- schedule
- origin
- current Check-in
- reflection/completion history when available
- actions:
  - Edit
  - Done / Undone
  - Link / Unlink / Change Check-in
  - Delete

Drawer is preferable to full-page navigation for ordinary Action review.

On mobile:
- full-screen sheet/page is acceptable.

---

# 10. Edit Action

Edit may use the same modal family as Create.

Editable:
- title
- description
- schedule
- exact time
- current Check-in link

Origin metadata is read-only.

For Done Action:
- edit does not reopen.

---

# 11. Done Interaction & Rewarding Animation

## 11.1 Immediate state
When Done clicked:
- status changes immediately;
- check animation;
- card state transitions;
- small pigment/halo effect.

## 11.2 Color
If linked:
- animation pigment from current Check-in hex.

If independent:
- teal Action pigment.

## 11.3 Motion
Rewarding but restrained:
- ~250–450ms;
- small scale/halo/check pulse;
- no full-screen confetti;
- reduced-motion alternative.

## 11.4 Reflection trigger
After Done animation begins/completes:
- Reflection popup opens automatically every time.

No other click required.

---

# 12. Reflection Modal

Canonical question:

> **Làm xong, bạn thấy thế nào rồi?**

## 12.1 Outcome
- exactly one outcome selectable
- outcome options reference/config-driven

Illustrative only:
- Ổn hơn
- Nhẹ hơn một chút
- Không khác mấy
- Chưa ổn hơn
- Khác

Do not hardcode if Admin Studio already controls taxonomy.

## 12.2 Optional note
Plain multiline.

## 12.3 Actions
- Bỏ qua
- Lưu reflection

## 12.4 Critical behavior
Action is already Done even if:
- user closes;
- user skips;
- reflection save fails.

Reflection persistence failure must not undo successful Action completion.

---

# 13. Tab Behavior

## 13.1 Hôm nay
Contains:
- scheduled today
- date ranges active today

Right rail:
- 7-day Nhịp hành động
- Small Wins
- reflection outcome snapshot

## 13.2 Upcoming
Group:
- Ngày mai
- Tuần này
- Sau đó

No duplication for ranges.

## 13.3 Quá hạn
Tone:
- calm;
- non-shaming.

Recommended copy:
> “Có vài action vẫn đang chờ bạn.”

Quick action:
- Done
- Đổi lịch

No productivity guilt.

## 13.4 Chưa lên lịch
Capture inbox.

Actions:
- Lên lịch
- Done
- Edit
- Delete
- Link Check-in

## 13.5 Đã hoàn thành
Archive by completion time.

Each row may show:
- completion time/date
- reflection outcome
- source accent
- linked Check-in if still linked

Done Action remains editable without reopening.

---

# 14. Gentle Gamification

Gamification must reward self-follow-through, not productivity competition.

## 14.1 Nhịp hành động
Recommended v1 definition:

> number of distinct local days in the last 7 days where user completed at least 1 Action.

Presentation:
- seven dots/days
- active day = lit
- no punitive “streak reset to 0” messaging

This is a rolling rhythm, not a brittle classic streak.

## 14.2 Small Wins
“Small Wins” = number of Action completions in selected period.

Preferred language:
- “8 bước nhỏ mình đã làm được”
not:
- “8 tasks completed”

## 14.3 Reward color
Done animation uses emotional/source pigment as described above.

## 14.4 Những bước từng giúp
Insight based on completion + reflection.

V1 lightweight metric:
- count of completed Actions that received a positive/helpful reflection outcome.

Later:
- group by normalized Action/catalog item
- surface patterns like:
  - “Ra ngoài hít thở — 4 lần làm, 3 lần thấy ổn hơn”

Do not overclaim causality.

## 14.5 No punitive gamification
Do not add:
- XP
- points
- levels
- leaderboard
- red streak loss
- productivity score
- daily failure messages

---

# 15. Reflection Insight Semantics

Reflection outcome taxonomy should support grouping for UI insight.

Possible semantic groups:
- positive/helpful
- neutral/no change
- negative/not helpful
- other

Exact outcome IDs/names are reference-driven.

“Những bước từng giúp” should use semantic group, not brittle string matching.

---

# 16. Cross-Module Integration

## 16.1 Check-in → Action
Check-in may create:
- suggested Action
- custom Action

After creation:
- same canonical Action appears in Action Space immediately.

## 16.2 Home
Home “Việc cần làm” is a projection of canonical Actions.

Done from Home:
- same Done mutation;
- same Reflection popup.

## 16.3 Check-in Detail
Linked Action shown in Check-in Detail is same object.

Done from there:
- same reflection behavior.

## 16.4 Delete Check-in
If deleting Check-in with linked Action:
- ask user:
  - delete linked Action
  - keep Action independent

If kept:
- unlink current Check-in
- origin remains immutable
- card accent falls back to independent Action treatment because there is no current Check-in.

## 16.5 Delete Action
Hard-delete Action.
Do not delete Check-in.

---

# 17. Error Handling

## Create/Edit failure
- preserve entered content
- show inline/near-CTA error
- do not close modal as if successful

## Done mutation failure
- do not open reflection if Action was not actually marked Done
- restore interactive state
- show clear retry

## Reflection save failure
- keep Action Done
- keep selected outcome/note in modal if possible
- allow retry or close

## Link failure
- do not show linked state unless persistence succeeded.

---

# 18. Visual System

Use Sắc Ký canonical style.

Baseline:
- soft editorial canvas
- white surfaces
- violet as global action accent
- teal for independent Action accent
- Check-in hex for linked pigment
- restrained borders
- rounded surfaces consistent with Home/Check-in/Diary
- Be Vietnam Pro
- strong whitespace hierarchy

Do not:
- make Action Space look like Jira/Todoist clone
- fill cards with saturated colors
- add dense project-management chrome
- use priority colors
- use red except genuine overdue/destructive states

---

# 19. Responsive Behavior

## Desktop
- sidebar
- main list/workspace
- right supporting rail
- Action Detail drawer overlays/occupies right side without making list unreadable

## Intermediate width
- collapse right rail before squeezing Action cards
- keep card minimum readable width

## Mobile
- single-column
- tabs horizontally scrollable/segmented if needed
- Create/Edit modal becomes bottom sheet/full-screen sheet
- Detail drawer becomes full-screen sheet
- reflection modal remains focused
- schedule controls touch-friendly

---

# 20. Screen Inventory & Visual Authority

## A01 — Action Space / Today
Authority: `lavender_action_space_dashboard.png`

Locks:
- dashboard + tabs + compact Action list + supportive insight rail
- linked color rails
- Add Action CTA

## A02 — Create Action Modal
Authority: `pastel_vietnamese_action_planner_modal.png`

**This is canonical. Create Action is modal.**

Locks:
- Title
- optional note
- quick schedule
- link Check-in
- create CTA

## A03 — Upcoming
Authority: `calm_action_space_productivity_dashboard.png`

Locks:
- Ngày mai / Tuần này / Sau đó grouping
- same card anatomy
- future summary rail

## A04 — Overdue
Authority: `pastel_action_space_dashboard.png`

Locks:
- gentle overdue language
- Done + reschedule
- no guilt-heavy visual treatment

## A05 — Unscheduled
Authority: `action_space_gentle_steps_dashboard.png`

Locks:
- capture inbox
- schedule quick action
- calm explanatory right rail

## A06 — Completed
Authority: `sắc_ký_action_space_dashboard.png`

Locks:
- reflection outcome visible
- wins/rhythm rail
- completion archive

## A07 — Action Detail Drawer
Authority: `calm_purple_productivity_dashboard.png`

Locks:
- right drawer
- full metadata
- canonical controls
- reflection history

## A08 — Reflection Modal
Authority: `vietnamese_wellness_reflection_modal.png`

Locks:
- one question
- outcome selector
- optional note
- Skip / Save

## A09 — Plan / Link Check-in Content Reference
Reference: `vietnamese_action_planning_dashboard.png`

**Important:** this image is a CONTENT reference only.

Do not implement it as a permanent full-page “Create Action” flow.

Its useful pieces:
- Check-in picker
- selected Check-in preview
- date / date-range / time controls

These should be adapted into:
- Create/Edit modal expanded state;
- or a replacement panel/step inside the same overlay flow.

Avoid nested modal stacks.

## Deprecated visual
`minimal_pastel_vietnamese_action_dashboard.png` shows a full-page Create Action concept.

**Do not implement that page as normal v1 UX.**
Create Action is a modal.

---

# 21. Implementation Recommendations

## 21.1 Domain naming
If current DB/repository is named Reminder:
- avoid risky one-shot DB rename;
- introduce semantic Action service/types/UI;
- migrate naming incrementally.

## 21.2 Shared primitives
Reuse:
- Modal
- Drawer/Sheet
- Button
- Segmented/Tabs
- Surface
- SelectionCard
- Slider/date controls
- StatusPill
- Check-in picker card

## 21.3 Avoid duplicated mutation logic
One service mutation for:
- markDone
- markUndone
- updateAction
- deleteAction
- linkCheckin
- unlinkCheckin
- saveReflection

All surfaces call same canonical service.

---

# 22. QA / Acceptance Checklist

## Naming
- [ ] Navigation says Action Space.
- [ ] Home may say Việc cần làm.
- [ ] No user-facing Reminder concept remains where Action is intended.

## Create
- [ ] Create Action opens modal, not full page.
- [ ] Title required.
- [ ] Note optional.
- [ ] Unscheduled allowed.
- [ ] Date / date range / optional time supported.
- [ ] Link Check-in optional.

## Link
- [ ] Max 1 current Check-in per Action.
- [ ] Max 2 active Actions per Check-in.
- [ ] Origin never changes when link changes.
- [ ] Linked visual accent uses Check-in hex.

## Workspace
- [ ] Today works.
- [ ] Upcoming grouped Tomorrow / This week / Later.
- [ ] Overdue works.
- [ ] Unscheduled works.
- [ ] Completed works.
- [ ] Date-range Action not duplicated.

## Done / Reflection
- [ ] Done animation is rewarding but restrained.
- [ ] Reflection popup ALWAYS opens after successful Done.
- [ ] One question only.
- [ ] Outcome selectable.
- [ ] Note optional.
- [ ] Skip keeps Action Done.
- [ ] Reflection failure does not undo Done.
- [ ] Undone works.
- [ ] Redone creates a new completion/reflection cycle.

## Edit/Delete
- [ ] Editing Done does not reopen.
- [ ] Delete hard-deletes Action and its reflection/completion history.
- [ ] Delete Action does not delete Check-in.

## Gamification
- [ ] Nhịp hành động shown as gentle 7-day rhythm.
- [ ] Small Wins uses supportive language.
- [ ] No XP/points/leaderboard/productivity score.
- [ ] “Những bước từng giúp” only uses reflection-backed data.

## v1 boundary
- [ ] No notification implementation.
- [ ] No recurrence UI.
- [ ] No priority.
- [ ] No project/category taxonomy.

## Cross-module
- [ ] Action created from Check-in appears in Action Space immediately.
- [ ] Done from Home opens same reflection.
- [ ] Done from Check-in Detail opens same reflection.
- [ ] Same canonical object everywhere.

## Quality
- [ ] Lint passes.
- [ ] Tests pass.
- [ ] Build passes.
- [ ] Authenticated browser acceptance captured for all core surfaces.
- [ ] MacBook/16:10 matches approved visual direction.
- [ ] Intermediate/mobile layouts do not squeeze cards unreadably.

---

# 23. Suggested Implementation Slices

## Slice 1 — Semantic Rebase
- Reminder → Action Space UI/domain naming
- canonical Action types/service
- preserve existing DB safely

## Slice 2 — Workspace
- 5 tabs
- Action cards
- time grouping
- dashboard/rails

## Slice 3 — Create/Edit Modal
- Title/note
- unscheduled/date/range/time
- Check-in link picker

## Slice 4 — Done & Reflection
- mutation
- animation
- reflection modal
- completion cycles
- undo/redo

## Slice 5 — Gamification / Insight
- 7-day rhythm
- Small Wins
- helpful-reflection counts

## Slice 6 — Cross-module Integration
- Home
- Check-in
- linked action sync
- delete semantics

## Slice 7 — Hardening
- responsive
- accessibility
- errors
- regression tests
- hosted acceptance

---

# 24. Definition of Done

Action Space v1 baseline is complete when:

1. Reminder UI has become Action Space.
2. Canonical Action object is shared across Check-in, Home and Action Space.
3. Create Action is a modal.
4. Unscheduled Action is first-class.
5. Date/date-range/time planning works.
6. Link/unlink/change Check-in works with limits.
7. All five workspace tabs work.
8. Done always triggers rewarding feedback + Reflection popup.
9. Reflection asks only “Làm xong, bạn thấy thế nào rồi?” + optional note.
10. Undo/redo completion cycles work.
11. Hard delete works.
12. Gentle gamification works without productivity pressure.
13. Notifications, recurrence, priority and project taxonomy remain out of v1.
14. Visual composition matches approved Action Space mockups.
15. Lint/tests/build + authenticated browser acceptance pass.

**END — SẮC KÝ v2 ACTION SPACE v1.0**

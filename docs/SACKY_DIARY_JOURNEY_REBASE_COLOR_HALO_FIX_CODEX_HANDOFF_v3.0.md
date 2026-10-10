# SẮC KÝ v2 — DIARY / JOURNEY REBASE + HOME COLOR ORB FIX
## Codex Handoff v3.0
**Ngày:** 03/09/2026  
**Phạm vi:** Light Theme · Desktop-first · Diary module rebase + Home Color Halo Ring recovery  
**Repo:** `katherine205203/SacKySpace`

---

# 0. MỤC TIÊU CỦA PASS NÀY

Pass này có 2 mục tiêu bắt buộc:

1. **Rebase toàn bộ Diary architecture** thành một module cha có hai sub-surface độc lập:
   - `Diary`
   - `Journey`

2. **Khôi phục Home Color Orb đang bị blank/mất render**, đồng thời chuyển renderer về hướng **Color Halo Ring ổn định, code-native, không để lại khoảng trống nếu renderer lỗi**.

Không làm Dark Theme trong pass này.

Không redesign AppShell hiện tại.

Không tạo một design system mới cho Journey.

---

# 1. SIDEBAR / NAVIGATION REBASE

Sidebar giữ module cha:

`Diary`

Ngay bên dưới `Diary`, hiển thị 2 sub-nav:

- `Diary`
- `Journey`

Yêu cầu:
- sub-nav nằm trực tiếp dưới parent `Diary`;
- có indent / hierarchy nhẹ;
- khi user đang ở `Diary` hoặc `Journey`, parent `Diary` vẫn thể hiện active module;
- khi click parent `Diary` hoặc route mặc định, mở sub-nav `Diary`;
- `Journey` là surface riêng, không phải một feature phụ nằm trong Daily Diary.

Không thêm `Diary` và `Journey` thành hai item ngang hàng ở cấp root sidebar.

---

# 2. PRODUCT ARCHITECTURE MỚI

## 2.1 Module cha

```text
Diary
├── Diary
│   ├── Landing
│   ├── Editor
│   ├── History
│   ├── Read-only
│   └── Day Record
│
└── Journey
    ├── Landing
    ├── Create / Select timeframe
    ├── Editor
    ├── History
    ├── Read-only
    └── Journey Record
```

Hai surface này:
- có landing riêng;
- history riêng;
- editor riêng;
- read-only riêng;
- factual record riêng;
- dùng chung design system và shared primitives.

Không cần combined History.

---

# 3. DIARY SURFACE

## 3.1 Diary Landing

Mục tiêu:
- focus vào `Nhật ký hôm nay`;
- CTA chính: bắt đầu / tiếp tục / xem Diary ngày hiện tại;
- secondary action: `Lịch sử nhật ký`.

Không nhét Journey content vào Diary landing.

Journey đã có surface riêng.

## 3.2 Diary History

Chỉ hiển thị Daily Diary.

Không hiển thị Journey entries.

Filter có thể gồm:
- Tất cả trạng thái
- Draft
- Done

Không cần filter `Diary / Journey` nữa.

## 3.3 Daily Diary states

Giữ product rule đã chốt:

- 1 Diary / user / local calendar day
- Title required
- Overall required
- Prompt optional, max 6
- Primary Emotion optional, 0/1
- no intensity
- attach same-day Check-ins
- multi-select
- mỗi Check-in có weight độc lập
- weight không cần tổng 100
- max 4 images
- Save Draft
- User Done
- edit allowed
- delete allowed

---

# 4. USER DONE VS DAY LOCKED

Daily Diary có 2 khái niệm completion khác nhau.

## 4.1 User Done

Khi user bấm `Hoàn tất`.

Ý nghĩa:
> Tôi đã viết xong bài Diary này.

Nhưng:
- user vẫn có thể edit lại;
- Day Record vẫn tiếp tục tự động cập nhật trong ngày;
- Check-in mới sau User Done vẫn được ghi nhận;
- Action Done + Reflection mới sau User Done vẫn được ghi nhận.

## 4.2 Day Locked

Khi calendar day kết thúc.

Ý nghĩa:
> factual record của ngày đã có một mốc kết thúc.

Không dùng Day Locked để chặn user chỉnh Diary text.

Authored Diary vẫn được edit trực tiếp về sau.

---

# 5. DAY RECORD — “NGÀY NÀY ĐÃ DIỄN RA”

Daily Diary có factual context tự động.

Bao gồm:

### Check-in
- Emotion Check-in
- Unknown Check-in
- time
- primary emotion nếu có
- intensity nếu có
- secondary emotion nếu có
- note
- unknown prompt / response nếu có

### Completed Action
Chỉ Action mà user đã bấm Done trong ngày.

Bao gồm:
- emoji
- title
- description nếu cần
- source:
  - `Độc lập`
  - `Từ Check-in [emotion]`
- completed time
- reflection response
- reflection note nếu có

Không đưa pending / upcoming / overdue action vào Day Record.

Rule rất đơn giản:
> User bấm Done hôm nào thì Action thuộc factual record hôm đó.

---

# 6. DAY RECORD SAU KHI NGÀY KẾT THÚC

Sau Day Locked, source record vẫn có thể được sửa.

Ví dụ:
- sửa Check-in note;
- sửa emotion;
- sửa Reflection;
- sửa Action data.

Yêu cầu:
- mặc định hiển thị **current truth**;
- nếu factual item đã thay đổi sau khi ngày kết thúc, show badge nhẹ:
  `Đã cập nhật sau khi ngày kết thúc`;
- user có thể mở để xem:
  - `Khi ngày kết thúc`
  - `Hiện tại`

Không cần version history cho authored Diary text.

Chỉ factual Day Record cần giữ mốc cũ + current truth.

---

# 7. JOURNEY SURFACE

Journey là surface độc lập trong module Diary.

Sub-nav:
`Journey`

## 7.1 Journey Landing

Mục tiêu:
- giải thích ngắn gọn: user có thể nhìn lại một khoảng thời gian tự chọn;
- CTA chính: `Nhìn lại một chặng`;
- hiển thị Journey gần đây;
- có link `Lịch sử Journey`.

Không ép 7 ngày.

User chọn timeframe tùy ý:
- 5 ngày
- 10 ngày
- 20 ngày
- hoặc bất kỳ range hợp lệ nào.

Timeframe overlap được.

Có thể có nhiều Journey cùng một timeframe.

## 7.2 Journey History

Chỉ hiển thị Journey.

Card gồm:
- title
- date range
- số ngày
- primary emotion nếu có
- excerpt ngắn
- status Draft / Done

Không trộn Daily Diary.

---

# 8. JOURNEY CREATE / TIMEFRAME

User chọn:

- From date
- To date

Sau khi chọn range, show coverage brief:

- số ngày
- số Daily Diary
- số Check-in
- số Completed Action

Ví dụ:

`03/09 → 14/09 · 12 ngày`

`6 Diary · 9 Check-in · 4 việc đã làm`

Coverage chỉ là factual preview.

Không auto-attach mọi thứ vào Journey.

---

# 9. JOURNEY AUTHORED CONTENT

Journey có:

- Title
- Overall / Body Reflection
- Primary Emotion 0/1
- selected Daily Diary attachments
- selected Check-in attachments
- Check-in weights độc lập
- Closing Thought riêng

Status:
- Draft
- Done

Không có Week Lock / Journey Lock.

Không snapshot/version history riêng cho Journey.

User sửa sau này thì save trực tiếp current state.

---

# 10. JOURNEY PRIMARY EMOTION

Dùng chung canonical 117 emotions.

Rule:
- chọn 0 hoặc 1;
- không intensity;
- dùng shared Emotion Picker.

Không tạo Journey-specific emotion taxonomy.

---

# 11. JOURNEY ATTACHMENTS

User chủ động chọn.

Không auto-attach toàn bộ range.

## 11.1 Daily Diary attachment

Chỉ Daily Diary có `User Done = true` mới selectable.

Không cần chờ `Day Locked`.

Lưu reference tới Diary gốc.

Không snapshot nội dung Diary vào Journey.

Nếu Diary gốc được chỉnh sửa sau này:
- Journey đọc bản hiện tại.

## 11.2 Check-in attachment

Chọn Check-in nằm trong timeframe.

Multi-select.

Mỗi Check-in có weight slider độc lập.

Không cần tổng = 100%.

Giữ provenance/source gốc.

---

# 12. CLOSING THOUGHT

Closing Thought là block riêng.

Không gộp vào Overall.

Có thể dùng copy kiểu:

`Mang theo điều gì?`

hoặc:

`Một điều mình muốn tiếp tục giữ nhịp sau chặng này.`

Đây là authored field.

Không auto-convert sang Action / Gift / Future Letter trong v1.

---

# 13. JOURNEY RECORD — “NHỮNG GÌ ĐÃ DIỄN RA TRONG CHẶNG NÀY”

Journey cũng có factual context riêng.

Journey Record tự động lấy trong timeframe:

- tất cả Check-in;
- tất cả Action đã Done + Reflection;
- tất cả Daily Diary thuộc range.

Không yêu cầu những item này phải được user attach.

Đây là factual record.

Attachments là user-selected narrative context.

Hai lớp này phải tách rõ.

---

# 14. JOURNEY RECORD — GROUP THEO NGÀY

Không render một timeline dài liên tục.

Structure:

```text
03/09
  Check-in
  Diary
  Action Done + Reflection

04/09
  Check-in
  Check-in

05/09
  Diary
  Action Done
```

Mỗi ngày là một collapsible group.

Với timeframe ngắn:
- có thể default expand nhiều ngày.

Với timeframe dài:
- collapse theo ngày để tránh page quá dài.

Filter đơn giản:
- Tất cả
- Diary
- Check-in
- Việc nhỏ

Không biến thành admin audit log.

---

# 15. DAILY DIARY TRONG JOURNEY RECORD

Khi user click một Daily Diary trong Journey Record:

Mở:
**read-only drawer / modal**

Không route ngay.

Drawer/modal cho xem nhanh:
- date
- title
- Overall
- primary emotion
- prompt responses
- selected Check-ins
- images nếu có

Footer:
`Mở nhật ký`

Khi click `Mở nhật ký`:
route sang Daily Diary read-only đầy đủ.

Mục tiêu:
user xem nhanh mà không bị mất Journey context.

---

# 16. CHECK-IN / ACTION DETAIL TRONG JOURNEY RECORD

Check-in:
- dùng pattern detail giống Day Record.

Action:
- title
- description
- source badge
- completed time
- Reflection
- Reflection note nếu có

Không tạo interpretation mới.

Không AI summary.

---

# 17. SHARED DESIGN SYSTEM — HARD RULE

Journey và Diary có thể khác layout.

Nhưng không được khác design system.

Bắt buộc reuse:

- AppShell
- Be Vietnam Pro
- typography hierarchy
- Primary Button
- Secondary Button
- Input
- Textarea
- Date Picker wrapper
- Badge
- Segmented Control
- Modal
- Drawer
- Card/Surface
- spacing scale
- radius
- border
- shadow/elevation

Canonical Light Theme:

- canvas `#F8F6FF`
- surface `#FFFFFF`
- ink `#231B46`
- muted `#625A75`
- violet `#743CFF`
- strong violet `#5326BE`
- soft violet `#ECE4FF`
- border `#E5DDF5`

Primary CTA:
solid `#743CFF` + white.

No new page-specific font family.

No raw browser-looking controls.

---

# 18. UPDATED SCREEN MASTER LIST

## DIARY

### DY01 — Diary Landing
Today-focused landing.

### DY02 — Diary History
Daily Diary only.

### DY03 — Daily Editor Upper
Title, Overall, autosave, Day Record summary, rail.

### DY04 — Daily Editor Lower
Prompts, emotion, Check-ins, images.

### DY05 — Daily Read-only
Done Diary.

### DY06 — Day Record Detail
“Ngày này đã diễn ra”.

### DY07 — Prompt Picker
Shared Daily prompt picker.

### DY08 — Emotion Picker
Shared 117-emotion picker.

### DY09 — Daily Check-in Picker
Same-day Check-ins + independent weight.

---

## JOURNEY

### JY01 — Journey Landing
Journey-focused landing.

### JY02 — Journey History
Journey only.

### JY03 — Journey Create / Timeframe
Select from/to range + coverage brief.

### JY04 — Journey Editor
Title, Overall, Primary Emotion, selected attachments, Closing Thought.

### JY05 — Journey Attachment Picker
Tabs:
- Diary
- Check-in

Only `User Done` Daily Diary selectable.

### JY06 — Journey Read-only
Done Journey.

### JY07 — Journey Record Detail
Grouped-by-day factual range detail.

### JY08 — Daily Diary Quick View
Read-only drawer/modal from Journey Record.

Total canonical surfaces:
**17**

Không cần vẽ mọi edge state thành artboard riêng.

---

# 19. HOME COLOR ORB — CURRENT BUG

Current Home screenshot shows:

- the Orb visual area is blank;
- legend / counts still render;
- layout reserves Orb space but actual Halo Ring is missing.

This is a hard regression.

Fix it in the same pass.

Do not leave blank space.

---

# 20. COLOR ORB — LOCKED NEW RENDERER

Renderer direction remains:

# COLOR HALO RING

No more:
- Voronoi territories
- polygon cells
- Canvas influence field
- broken SVG paths
- global blurred sphere

The Ring must be simple and robust.

---

# 21. DO NOT USE CSS MASK AS THE ONLY WAY TO CREATE THE RING

The current blank state may be caused by:
- mask compatibility;
- incorrect `mask-composite`;
- invalid gradient;
- zero-size element;
- transparent output.

To maximize reliability:

## Preferred implementation

Use:

1. Outer circular div
2. `background: conic-gradient(...)`
3. `border-radius: 50%`
4. Inner circular child/pseudo-element placed above it

Conceptually:

```text
[outer circle: conic gradient]
        ↓
[inner circle: surface/canvas color]
        ↓
visual result = thick ring
```

Do not rely on `mask-composite` to make the hole.

This is more browser-stable.

---

# 22. COLOR HALO DOM STRUCTURE

Recommended:

```tsx
<div className="colorHalo">
  <div className="colorHalo__inner">
    <strong>{checkinCount}</strong>
    <span>Check-ins</span>
  </div>
</div>
```

Outer:
- fixed responsive square aspect ratio;
- explicit width / height / aspect-ratio;
- conic-gradient background;
- border-radius 50%.

Inner:
- absolute centered circle;
- background = current Home surface/canvas color;
- creates the hole;
- pointer-events none.

This guarantees the Ring remains visible.

---

# 23. HALO GRADIENT DATA

Keep existing approved presence formula.

Intensity weights:

- 1 → 1.00
- 2 → 1.35
- 3 → 1.80
- 4 → 2.40
- 5 → 3.20

No Secondary:
- Primary 100%

1 Secondary:
- Primary 70%
- Secondary 30%

2 Secondary:
- Primary 70%
- Secondary A 15%
- Secondary B 15%

3 Secondary:
- Primary 70%
- Secondary A 10%
- Secondary B 10%
- Secondary C 10%

Unknown Check-in:
excluded.

Normalize to 100%.

---

# 24. COLOR ORDER / BLEND

Use real emotion `hex_color`.

Convert to OKLCH / OKLab for perceptual ordering.

Arrange similar colors next to one another.

Generate conic-gradient stops such that:

- each emotion has a core span;
- similar neighbor colors receive a wider transition zone;
- distant colors receive a narrower transition;
- no hard separator lines.

Do not globally tint purple.

Do not blur the entire Ring.

---

# 25. RING FALLBACK — NEVER BLANK

Hard rule:

If there are eligible emotions but gradient generation fails:
- render a simple fallback conic gradient using source hex colors with proportional spans.

If there are zero eligible emotions:
- render neutral lavender ring.

The Home must never reserve Orb space and render nothing.

Fallback priority:

```text
enhanced blended halo
→ simple proportional conic halo
→ neutral empty halo
```

Never:
`blank transparent area`

---

# 26. SIZE / LAYOUT SAFETY

The Halo wrapper must always have explicit layout dimensions.

Use:
- `aspect-ratio: 1 / 1`;
- responsive width;
- min/max size.

Example:
- desktop width around 360–460px depending current hero;
- no `height: 100%` without parent height;
- no zero-dimension SVG/canvas.

Ensure:
- Ring stays within hero;
- does not overlap right-side controls;
- no blank reserved region.

---

# 27. HALO INTERACTION

Keep approved interaction:

Hover:
- resolve emotion by pointer angle;
- highlight arc;
- tooltip.

Tooltip:
- emoji
- VN name
- EN name
- percentage

Optional:
- Primary count
- Secondary count

Click:
pin.

Escape/outside click:
unpin.

Legend hover/click:
sync with Ring.

Hit testing should use the underlying angular ranges,
not sampled pixel color.

---

# 28. HOME REGRESSION ACCEPTANCE

Home passes only if:

- Halo Ring visibly renders;
- empty state also visibly renders;
- no blank area;
- legend matches percentages;
- Today / Week / Month / Custom work;
- hover works;
- click pin works;
- no layout overlap;
- no changes to accepted AppShell/theme.

---

# 29. REQUIRED IMPLEMENTATION ORDER

Do not build more Journey UI before fixing shared conformance.

Order:

1. Audit Diary/Journey routes and sidebar.
2. Add `Diary` / `Journey` sub-nav under parent Diary.
3. Reuse shared design primitives.
4. Split Diary landing/history from Journey landing/history.
5. Implement Journey record grouping + quick view pattern.
6. Fix Home Color Halo Ring visibility.
7. Verify existing Daily Diary.
8. Verify Home.
9. Lint.
10. Tests.
11. Build.
12. Screenshot acceptance.

---

# 30. REQUIRED SCREENSHOT ACCEPTANCE

Capture at same desktop viewport:

### Navigation / Diary
1. Diary Landing with sidebar sub-nav.
2. Diary History.
3. Daily Diary Editor.
4. Day Record Detail.

### Journey
5. Journey Landing.
6. Journey History.
7. Journey Create / Timeframe.
8. Journey Editor.
9. Journey Record grouped by day.
10. Daily Diary Quick View drawer/modal.

### Home
11. Home with visible multi-emotion Color Halo Ring.
12. Home Halo hover state.
13. Home empty Halo state.

Hard visual check:
- same font;
- same button grammar;
- same fields;
- same surface/radius/border;
- no native browser-looking controls;
- no blank Color Orb.

Do not commit / push / deploy before owner review.

---

# FINAL LOCK

## Diary architecture

`Diary`
→ `Diary`
→ `Journey`

Two independent surfaces under one parent module.

Daily Diary owns:
- Daily authored Diary
- Day Record

Journey owns:
- user-selected timeframe reflection
- selected Done Daily Diary attachments
- selected Check-ins + independent weights
- Primary Emotion
- Closing Thought
- Journey Record grouped by day
- Daily Diary Quick View

## Home Color Orb

Previous territory renderer is deprecated.

Canonical renderer:
**Color Halo Ring**

Implementation must degrade safely and must **never render a blank Orb area**.

# SẮC KÝ v2 — DIARY UPDATE CODEX HANDOFF v2.0

**Ngày cập nhật:** 03/09/2026  
**Scope:** Light theme, desktop-first, module Diary  
**Repo:** `katherine205203/SacKySpace`  
**Local repo:** `/Users/katherinebui/Documents/SacKySpace`

Tài liệu này thay thế cách hiểu cũ rằng Diary chỉ là “Nhật ký hôm nay”. Sau update này, **Diary là một module chung có hai loại nhật ký**: **Nhật ký ngày** và **Nhật ký chặng**. Hai loại dùng chung app shell, design grammar, emotion reference data, Check-in data và một số picker/component, nhưng có intent và interaction khác nhau. Không tách Nhật ký chặng thành module/sidebar item riêng.

Mockup là visual reference để khóa direction, nhưng **product rules trong tài liệu này là authority** khi có khác biệt với text giả/lỗi phát sinh trong image generation. Mục tiêu implementation: **>=85% visual fidelity ở content area**, đồng thời không vi phạm product rule.

---

## 1. PRODUCT MODEL MỚI CỦA DIARY

### 1.1. Hai loại Diary trong cùng module

**Nhật ký ngày** trả lời: “Hôm nay mình muốn ghi lại điều gì?”  
Mỗi user/local calendar day có tối đa một Daily Diary. Đây vẫn là flow chính và được ưu tiên trên Diary landing.

**Nhật ký chặng** trả lời: “Mình muốn nhìn lại một khoảng thời gian như thế nào?”  
User tự chọn `from_date → to_date`; có thể là 5, 10, 20 ngày hoặc bất kỳ khoảng hợp lệ nào. Không gọi feature này là Weekly Diary trong UI/business logic.

Journey Diary được phép:
- overlap timeframe với Journey Diary khác;
- có nhiều Journey Diary cùng một timeframe;
- Draft hoặc Done;
- chỉnh sửa sau Done;
- không có system lock;
- không cần snapshot/version history cho nội dung Journey Diary.

---

## 2. NHẬT KÝ NGÀY — AUTHORING + DAY RECORD

Daily Diary có hai lớp khác nhau và không được trộn thành một form lớn.

### 2.1. Authored Diary

Đây là phần user chủ động viết/chọn và giữ các rule hiện tại:
- exactly 1 Diary/user/local calendar day;
- Title required, max 120;
- Overall required, plain multiline;
- Prompt optional, max 6;
- mỗi selected prompt có response riêng và Done tick riêng;
- prompt Done không bắt buộc để Diary Done;
- Daily Main Emotion optional, 0/1, chọn từ canonical 117 emotions, **không intensity**;
- Check-in attachment optional, chỉ Check-in cùng ngày;
- multi-select;
- mỗi selected Check-in có weight % độc lập;
- weight **không cần cộng thành 100%**;
- max 4 images;
- Save Draft / User Done;
- user có thể Edit sau Done;
- delete allowed;
- backfill Daily Diary chỉ qua History.

Authored Diary diễn đạt **những gì user chủ động chọn để kể/ghi nhớ**. Không tự động inject toàn bộ factual activity của ngày vào body hoặc selected attachments.

### 2.2. Day Record — factual context tự động

Mỗi Daily Diary có một factual layer gọi **“Ngày này đã diễn ra”**. Day Record tự động phản ánh những gì thực sự xảy ra trong Sắc Ký trong calendar day đó.

Day Record gồm:
- **Emotion Check-in**;
- **Unknown Check-in**;
- timestamp;
- primary emotion/intensity/secondary nếu applicable;
- Unknown prompt/response nếu applicable;
- Check-in note;
- completed Action;
- Action title/description;
- source `Independent` hoặc `From Check-in`;
- source Check-in/emotion nếu applicable;
- thời điểm user bấm Done Action;
- Reflection response;
- Reflection note nếu có.

**Không đưa Action chưa Done vào Day Record.**  
Action được tính vào ngày **user bấm Done hôm nào thì thuộc ngày đó**, không thiết kế backdated completion phức tạp.

### 2.3. User Done ≠ Day Locked

Daily Diary có hai khái niệm completion:

**User Done** = user nói “Tôi đã viết xong bài hôm nay”.  
Sau User Done nhưng ngày chưa kết thúc:
- user vẫn Edit Authored Diary bình thường;
- Check-in mới vẫn tự động vào Day Record;
- Action Done mới vẫn tự động vào Day Record;
- Reflection mới/sửa vẫn cập nhật factual context.

**Day Locked** = calendar day thực sự kết thúc.  
UX có thể nói ngày khóa lúc kết thúc ngày; implementation nên dựa trên local-date boundary sang ngày kế tiếp thay vì phụ thuộc timer mong manh đúng `23:59:59`.

Conceptual state tối thiểu:
- `draft`
- `user_done`
- `day_locked`

`user_done` không phải seal và không ngăn Edit.

### 2.4. Sau Day Locked: giữ bản lúc ngày kết thúc + current truth

Nếu user sửa factual source sau khi ngày đã kết thúc — ví dụ sửa Check-in, note, emotion/intensity, Action, Reflection — **không overwrite historical fact mà không để lại dấu vết**.

Cần giữ được hai lớp:
1. **State tại thời điểm ngày kết thúc**;
2. **Current source state**.

UI mặc định hiển thị **current truth**. Nếu source đã thay đổi sau ngày kết thúc, hiện indicator nhẹ:

`Đã cập nhật sau khi ngày kết thúc`

Khi expand:
- `Khi ngày kết thúc` → factual state cũ;
- `Hiện tại` → factual state mới.

Nếu có nhiều lần sửa, có thể giữ revision metadata/thread ở data layer, nhưng UI v1 không cần biến thành audit log kỹ thuật.

**Không version authored Diary text.** Sau Day Locked, Title/Overall/Prompt/Emotion/selected attachment/weight/images vẫn edit trực tiếp và lưu current value.

---

## 3. NHẬT KÝ CHẶNG — USER-DEFINED TIMEFRAME REFLECTION

### 3.1. Timeframe

User chủ động chọn:
- `from_date`
- `to_date`

Cho phép:
- timeframe bất kỳ hợp lệ;
- overlap;
- nhiều Journey Diary cùng timeframe.

Không có weekly cadence, không auto-create mỗi 7 ngày, không streak riêng cho Journey Diary trong scope này.

### 3.2. Core authored content

Journey Diary là reflection object riêng, không phải merge 7 Daily Diary.

Core content:
- timeframe required;
- Title;
- main body / overall reflection;
- Primary Emotion optional, 0/1;
- canonical 117 emotions;
- no intensity;
- selected Daily Diary attachments trong timeframe;
- selected Check-in attachments trong timeframe;
- mỗi selected Check-in có independent weight slider;
- weights **không cần tổng 100%**;
- Closing Thought là một area tách riêng khỏi body;
- Draft / Done;
- Edit allowed after Done;
- không lock;
- không snapshot/version history.

Không có AI summary.  
Không có section “Điều gì đã giúp mình”.  
Không auto-attach mọi Daily Diary/Check-in: **user tự chọn**.

### 3.3. Journey Record — brief by default

Journey Diary vẫn có factual Record nhưng main editor/read-only chỉ hiển thị **brief context**, ví dụ:

`12 ngày · 9 Check-in · 6 Nhật ký ngày · 4 việc đã làm`

Có action `Xem chi tiết` để mở detail surface. Detail có thể reuse record/timeline component của Day Record theo range, nhưng không được khiến main Journey Diary thành dashboard dữ liệu.

Record chỉ factual; không tự diễn giải tâm lý, không AI summary.

### 3.4. Closing Thought

Closing Thought phải là một visual section riêng ở cuối bài, không phải textarea giống hệt Overall đặt tiếp bên dưới.

Purpose: một điều user muốn “mang theo” sau chặng đó.  
Không tự convert thành Action/Gift/Future Letter trong scope này.

---

## 4. DIARY MODULE NAVIGATION / LANDING / HISTORY

Sidebar vẫn chỉ có **Diary**. Không thêm “Journey Diary” vào global nav.

Diary module cần thể hiện hai intent nhưng **Daily vẫn là primary**:
- `Viết nhật ký hôm nay` là CTA chính;
- `Nhìn lại một chặng` là secondary entry;
- History hỗ trợ `Tất cả / Nhật ký ngày / Nhật ký chặng`.

Không biến Diary landing thành 2 sản phẩm 50/50 hoặc SaaS dashboard. Không cần 4 KPI cards rời rạc kiểu `streak / longest / month / draft` nếu chúng làm mất trọng tâm viết.

History card phải phân biệt được Daily vs Journey nhưng dùng chung design grammar. Journey entry hiển thị date range; Daily entry hiển thị calendar date.

---

## 5. SHARED PICKERS / REUSE

### Emotion Picker
Dùng chung cho Daily và Journey:
- canonical 117 emotions;
- single-select;
- no intensity;
- search;
- real emotion emoji/name/color;
- không tạo taxonomy mới.

### Daily Check-in Picker
- chỉ same-day Check-ins;
- multi-select;
- note/time/VN+EN/context đủ để nhận diện;
- selected Check-in có independent weight slider;
- không cần tổng 100%.

### Journey Attachment Picker
Trong selected timeframe, user có thể chọn:
- **Nhật ký ngày**;
- **Check-in**.

Recommended desktop modal: 2 tabs `Nhật ký ngày / Check-in`, selected rail bên phải.  
Daily Diary = select/unselect, không cần weight.  
Check-in = select/unselect + independent weight slider.

Không auto-select toàn bộ record trong range.

---

## 6. UI CANONICAL SET — 12 SCREENS

### PACK A — D01 → D06

| ID | Screen | Role | Mockup |
|---|---|---|---|
| D01 | Diary History | History chung `Tất cả / Ngày / Chặng`; entry point cho hai loại Diary | `mockups/Pack_A/D01_Diary_History.png` |
| D02 | Daily Editor — Upper | Title, Overall, autosave, Save Draft/User Done, right rail, brief Day Record | `mockups/Pack_A/D02_Daily_Editor_Upper.png` |
| D03 | Daily Editor — Lower | Prompt responses, Daily Main Emotion, selected Check-ins + weights, images | `mockups/Pack_A/D03_Daily_Editor_Lower.png` |
| D04 | Prompt Picker | Modal chọn tối đa 6 prompt Daily | `mockups/Pack_A/D04_Prompt_Picker.png` |
| D05 | Emotion Picker | Shared 117-emotion single-select modal | `mockups/Pack_A/D05_Emotion_Picker.png` |
| D06 | Daily Check-in Picker | Same-day Check-in multi-select + independent weight | `mockups/Pack_A/D06_Daily_Checkin_Picker.png` |

### PACK B — D07 → D12

| ID | Screen | Role | Mockup |
|---|---|---|---|
| D07 | Daily Read-only | Daily Diary sau User Done; authored content là chính; Day Record là secondary entry | `mockups/Pack_B/D07_Daily_ReadOnly.png` |
| D08 | Day Record Detail | Factual timeline Check-in + Done Action + Reflection; support post-lock change indicator | `mockups/Pack_B/D08_Day_Record_Detail.png` |
| D09 | Journey Timeframe Setup | Chọn `from → to`, coverage brief, CTA bắt đầu viết | `mockups/Pack_B/D09_Journey_Timeframe_Setup.png` |
| D10 | Journey Editor | Title/body, Primary Emotion, selected Daily Diaries, selected Check-ins, brief range record, Closing Thought | `mockups/Pack_B/D10_Journey_Editor.png` |
| D11 | Journey Attachment Picker | Tabs Daily Diary/Check-in + selected rail + Check-in weights | `mockups/Pack_B/D11_Journey_Attachment_Picker.png` |
| D12 | Journey Read-only | Journey Diary Done; authored reflection + attachments + Closing Thought + brief record | `mockups/Pack_B/D12_Journey_ReadOnly.png` |

**Important:** Một screen = một PNG. Không ghép artboards vào collage khi dùng cho acceptance hoặc Codex implementation reference.

---

## 7. VISUAL SYSTEM — KHÔNG ĐƯỢC DRIFT

Follow current Sắc Ký Light Theme:
- canvas `#F8F6FF`
- surface `#FFFFFF`
- ink `#231B46`
- muted `#625A75`
- violet `#743CFF`
- strong violet `#5326BE`
- soft violet `#ECE4FF`
- border `#E5DDF5`
- danger `#FF5C70`
- font `Be Vietnam Pro`
- Primary CTA = solid violet + white, không gradient.

Style:
- clean;
- editorial;
- vivid;
- young;
- warm;
- content-driven;
- không kawaii/mascot;
- không SaaS dashboard nặng;
- không glassmorphism tràn lan;
- không card-inside-card vô tội vạ;
- không pastel nhợt toàn màn.

Data colors (emotion/source) phải dùng real hex khi applicable và đủ vivid.

---

## 8. DATA / ARCHITECTURE GUIDANCE

Không bắt buộc tên table/field dưới đây nếu repo hiện tại đã có model tốt hơn, nhưng semantic phải hỗ trợ các capability sau.

Conceptual Diary fields:

```text
diary_type: daily | journey
status: draft | done

# daily
diary_date
user_done_at
day_locked_at

# journey
range_start
range_end
closing_thought

# shared
title
overall/body
primary_emotion_id
```

Relationships:
- Daily selected prompts;
- selected Check-ins + weight;
- Journey selected Daily Diaries;
- Journey selected Check-ins + weight;
- existing image relations for Daily;
- Day Record factual source links;
- day-lock factual snapshot/current revision support.

Day Record source events must remain linked to original Check-in/Action/Reflection IDs. Do not store only rendered text summaries.

Display copy must use shared content/UI content service if the project already has the registry in place. Display text must never be business logic.

---

## 9. IMPORTANT PRODUCT DISTINCTIONS

Do not collapse these distinctions:

**Daily selected Check-ins** ≠ all Check-ins of Day Record.  
One is user-authored attachment; one is factual context.

**User Done** ≠ Day Locked.  
User Done ends the writing session; Day Record stays live until calendar day ends.

**Journey attachments** ≠ Journey Record.  
Attachments are user-selected; Record is automatic factual context.

**Daily authored edits after lock** ≠ factual source revisions.  
Authored edits overwrite current Diary; factual source revisions retain day-end historical state.

**Primary Emotion for Diary/Journey** ≠ automatically calculated dominant emotion.  
It is chosen by the user.

---

## 10. OUT OF SCOPE FOR THIS PASS

Do not add:
- Dark Theme;
- AI summary;
- AI interpretation;
- “Điều gì đã giúp mình” analytics;
- Journey streak;
- calendar planning;
- automatic Journey Diary cadence;
- unique constraint forcing one Journey Diary per timeframe;
- snapshot/version history for Journey Diary authored content;
- snapshot/version history for Daily authored text;
- new sidebar module for Journey Diary.

Color Orb / Home renderer is a separate workstream and not part of this Diary handoff.

---

## 11. HARD ACCEPTANCE

Implementation is PASS only when:

1. Daily and Journey coexist inside the same Diary module.
2. Daily existing product rules are preserved.
3. Daily has a live Day Record before day end.
4. Unknown Check-ins appear in Day Record.
5. Only Done Actions appear in Day Record.
6. Action belongs to the calendar day on which user pressed Done.
7. User Done does not stop later same-day factual updates.
8. Day Locked preserves day-end factual state while default UI can show current truth.
9. Daily authored Diary remains directly editable without authored revision history.
10. Journey supports arbitrary user-selected timeframe.
11. Journey timeframes may overlap and multiple Journey Diaries may share the same timeframe.
12. Journey has Draft/Done only; no lock/version history.
13. Journey Primary Emotion = user-selected 0/1 from 117 canonical emotions, no intensity.
14. Journey Daily Diary attachments are user-selected.
15. Journey Check-in attachments are user-selected and have independent weight sliders.
16. No weight sum-to-100 requirement.
17. Journey Closing Thought is visually separate from body.
18. Journey Record stays brief on main page and opens detail on demand.
19. No AI summary/interpretation.
20. Content area implementation reaches **>=85% fidelity** to canonical mockups after accounting for real data/content length.

Visual fidelity rubric:
- Layout/composition 25%
- Spacing/density 20%
- Typography/hierarchy 15%
- Component shape/state 15%
- Color/contrast 10%
- Interaction structure 15%

PASS = >=85% + zero product-rule violation.

---

## 12. REQUIRED IMPLEMENTATION / ACCEPTANCE WORKFLOW

Follow the existing owner workflow:

**CODEX IMPLEMENT → localhost review → lint/test/build → authenticated desktop screenshots → owner review → correction pass → only then commit/push/deploy.**

Before owner approval, do **not** commit/push/deploy.

Required acceptance screenshots should include at minimum:
- D01 History with both Daily + Journey entries;
- D02/D03 Daily editor with Day Record brief;
- D06 selected same-day Check-ins + independent weights;
- D07 Daily User Done while day is still open;
- D08 Day Record with Emotion Check-in + Unknown Check-in + Done Action + Reflection;
- D08 post-lock factual item with `Đã cập nhật sau khi ngày kết thúc`;
- D09 arbitrary Journey timeframe;
- D10 Journey Draft with selected Daily Diaries + Check-ins + Primary Emotion + Closing Thought;
- D11 both picker tabs and independent Check-in weights;
- D12 Journey Done/read-only.

Run and pass:
- lint;
- relevant tests;
- build;
- no new console errors;
- no data loss/reload bug in Diary input/autosave.

---

# FINAL IMPLEMENTATION PRINCIPLE

**Nhật ký ngày** lưu câu chuyện user muốn kể về một ngày, đồng thời Sắc Ký giữ factual trace của ngày đó ở lớp `Ngày này đã diễn ra`.

**Nhật ký chặng** cho user chủ động lùi lại và viết về một khoảng thời gian do chính họ chọn, đồng thời có factual range context đủ ngắn để hỗ trợ nhớ lại mà không giành quyền diễn giải của user.

Hai loại Diary phải tạo cảm giác là **hai cách nhìn trong cùng một thế giới Sắc Ký**, không phải hai feature bị ghép cạnh nhau.

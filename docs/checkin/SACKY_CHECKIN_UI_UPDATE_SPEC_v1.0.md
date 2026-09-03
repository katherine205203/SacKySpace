# SẮC KÝ v2 — CHECK-IN UI UPDATE SPECIFICATION v1.0

**Document type:** Visual implementation specification + Codex build contract  
**Module:** Check-in  
**Status:** Approved visual direction for implementation  
**Date:** 29/08/2026  
**Desktop priority:** MacBook / 16:10 desktop first  
**Production target:** `sacky-space` / `https://sacky-space.vercel.app`  
**Repository target:** `katherine205203/SacKySpace`  
**Expected working branch:** `feat/home-v2` unless repository state has since moved forward

---

## 0. Purpose

Tài liệu này nối ba nguồn thành một implementation contract duy nhất cho Codex:

1. **Check-in Product & UX Specification v1.0** — khóa product semantics, state, behavior, limits, persistence, History, Action và integration.
2. **Sắc Ký v2 — UI System & Style Specification v1.0** — khóa visual language, token system, components, layout grammar và interaction rules.
3. **Bộ mockup Check-in desktop được duyệt ngày 29/08/2026** — khóa hướng bố cục và visual treatment cho từng screen.

Khi có xung đột: product behavior/data semantics thắng; UI System & Style Spec thắng legacy CSS/screenshot cũ; mockup là visual target nhưng không được làm sai product rule.

---

# 1. Visual Constitution áp dụng cho Check-in

Check-in dùng đúng **Soft Editorial Color System** và cùng DNA với Home:

- Canvas `#F8F6FF`
- Surface `#FFFFFF`
- Primary ink `#231B46`
- Muted ink `#625A75`
- Accent violet `#743CFF`
- Accent strong `#5326BE`
- Accent soft `#ECE4FF`
- Border `#E5DDF5`
- Danger `#FF5C70`
- Font **Be Vietnam Pro**, 400 / 500 / 600 / 700
- Desktop sidebar ~212px
- Global content max-width ~91–92rem
- Principal zone gap 16px
- Standard surface radius 22px
- Compact card radius 16px
- Control radius 12px
- Standard surface padding 20–24px
- Motion 150–180ms, restrained

### Non-negotiable visual rules
- Emotion color = content pigment, không phải app chrome.
- Standard primary CTA = solid violet, không mặc định gradient.
- Space + typography trước boxes.
- Không card-inside-card lặp vô nghĩa.
- Không giant background card bao toàn dashboard.
- Không infinite scroll.
- Không mascot/kawaii.
- Không glassmorphism phủ khắp app.
- Không pastelize emotion pigment tới mức mất màu thật.
- Selected state luôn có non-color cue.
- One visual anchor per zone.

---

# 2. App-shell contract

- Reuse đúng authenticated app shell của Home.
- Sidebar width, brand lockup, navigation order và active-nav pattern giữ đồng bộ.
- Main canvas dùng cùng canvas token.
- Admin Studio ở footer area như Home.
- Không tạo shell riêng cho Check-in.
- Main canvas chịu page scroll; selection panel chịu bounded internal scroll khi cần.
- Desktop-first 16:10 trước, sau đó reflow theo 70rem / 58rem / 42rem / 27rem.

---

# 3. Shared component inventory

| Primitive | Use |
|---|---|
| `Surface` | section/card tiêu chuẩn |
| `CompactCard` | recent emotion, review chips, history row |
| `Button` | primary / secondary / ghost / danger |
| `SegmentedControl` | intensity / time range |
| `FilterChip` | emotion family / filters |
| `SelectionTile` | emotion / need / context / action |
| `Input` / `Textarea` | search / note / custom action |
| `Modal` | decision / action / reflection / destructive confirm |
| `Popover` | Need/Context description |
| `ColorOrb` | summary + History aggregate |
| `StepProgress` | deepening flow |
| `StickySummary` | creation/deepening desktop |
| `HistoryRow` | completed Check-in |
| `StatusPill` | draft / done / overdue / intensity |
| `IconButton` | close / info / edit |

Do not duplicate Home button/modal/surface recipes under Check-in-specific CSS if the same role already exists.

---

# 4. Screen inventory & visual targets

## 01. Landing

![Landing](mockups/01_landing.png)

**Implementation requirements**

- Giữ hero/header nhẹ, current streak là continuity cue, không gamification.
- Hai mode Emotion/Unknown cân bằng về trọng lượng thị giác; Emotion primary emphasis nhưng Unknown không bị xem như lỗi.
- Nếu có draft, strip “Tiếp tục bản nháp” nằm dưới mode cards; không làm layout nhảy mạnh.
- Không dùng mascot; orb/abstract pigment visual là visual anchor duy nhất của zone.

## 02. Primary Emotion Workspace

![Primary Emotion Workspace](mockups/02_primary_emotion.png)

**Implementation requirements**

- Desktop gồm Main workspace + sticky Summary sidebar.
- Family filter + search + Recent emotions nằm trên bounded emotion collection; list emotion scroll nội bộ.
- Primary chỉ chọn 1; selected item giữ nguyên vị trí, có outline + check + tint, không chỉ dựa vào màu.
- Intensity 5 mức bắt buộc; Note optional và giữ xuyên flow.
- CTA Lưu chỉ active khi có Primary + Intensity.

## 03. Primary Decision Modal

![Primary Decision Modal](mockups/03_primary_decision_modal.png)

**Implementation requirements**

- Modal có đúng 3 hướng: Vậy là đủ / Đào sâu thêm / Chọn Action.
- Bấm Lưu ở Primary chỉ mở modal; chưa commit completed Check-in.
- Cancel/close không auto-complete.
- Decision modal là canonical floating surface; không stack sâu với Action modal.

## 04. Deepening — Secondary Emotion

![Deepening — Secondary Emotion](mockups/04_secondary_emotion.png)

**Implementation requirements**

- Max 2 secondary; không trùng Primary, không duplicate; same family được phép.
- Selection region bounded; selected item không di chuyển.
- Note luôn hiện và giữ nguyên.
- Có Back / Bỏ qua / Lưu nhanh / Tiếp tục; Quick Save mở 3-way decision modal.

## 05. Deepening — Need

![Deepening — Need](mockups/05_need.png)

**Implementation requirements**

- Max 3 Need; bounded internal scroll.
- Need card compact; description đi qua info affordance, desktop hover/focus popover.
- Khi đạt max, không silent replace; user vẫn unselect/resolve được.
- Summary rail cập nhật ngay nhưng chỉ từ cùng draft object.

## 06. Deepening — Context

![Deepening — Context](mockups/06_context.png)

**Implementation requirements**

- Max 2 Context; bounded selection.
- Hiển thị cue “Đã chọn 2/2” khi chạm giới hạn.
- Giữ note, selected Need, Secondary và Primary xuyên step.
- CTA cuối dẫn Review; Skip vẫn hợp lệ.

## 07. Review Check-in

![Review Check-in](mockups/07_review.png)

**Implementation requirements**

- Review hiển thị Primary, Intensity, Note, Secondary, Need, Context.
- Mỗi section có Sửa/Jump trực tiếp; không bắt Back tuần tự.
- Tại Review không còn Quick Save.
- Bấm Lưu chỉ mở 2 lựa chọn: Vậy là đủ / Chọn Action.

## 08. Unknown Workspace

![Unknown Workspace](mockups/08_unknown.png)

**Implementation requirements**

- Entry random đúng 1 active prompt; có Đổi prompt.
- Note bắt buộc; đổi prompt không làm mất note; Unknown không có intensity.
- Unknown completed tính count + streak nhưng không đóng góp Color Orb.
- Nếu chuyển sang Emotion, prompt + note + origin provenance phải được giữ đến khi commit hợp lệ.

## 09. Action Modal

![Action Modal](mockups/09_action_modal.png)

**Implementation requirements**

- Mặc định hiển thị 3 suggested Actions với estimated duration.
- Có Làm mới gợi ý, Xem tất cả, custom Action, date/date-range và exact time optional.
- Action là canonical object; nếu tạo từ unsaved Check-in thì Check-in + Action + linkage phải commit nhất quán.
- Thôi không chọn quay về decision context; không auto-complete Check-in.
- Một Check-in tối đa 2 active linked Actions.

## 10. History + Detail

![History + Detail](mockups/10_history.png)

**Implementation requirements**

- Time presets Hôm nay / Tuần này / Tháng này / Tùy chọn cùng thay đổi metrics + Orb + list.
- Default sort created_at DESC; edit không đổi created_at và không đẩy record lên đầu.
- History mix Emotion và Unknown; Unknown title “Mình còn đang mơ hồ”.
- Detail dùng cùng canonical Check-in; cho Edit/Delete/Add Action/Done/Undone.
- Delete Check-in có linked Action phải hỏi delete Action hay giữ independent.


---

# 5. Interaction & state contract

## Draft
- Autosave chỉ tạo/cập nhật draft.
- Draft không vào History, metrics, streak hoặc Orb.
- Note/selection survive Back, Skip, prompt change, modal open/close và reload.
- Rời flow có data có thể báo “Đã lưu bản nháp”, nhưng không gọi completed.

## Selection
- Selected tile giữ vị trí.
- Không auto-reorder.
- Không silent replace khi max selection.
- State = border + tint + indicator/check + optional pigment.
- Keyboard Tab / Enter / Space; focus visible.

## Save hierarchy
- Primary `Lưu` -> 3-way Decision Modal.
- Quick Save -> 3-way Decision Modal.
- Review `Lưu` -> 2-way Decision Modal.
- Unknown `Lưu` -> 3-way Decision Modal.
- Completed-save failure không navigate Home như thể thành công.

## Modal hierarchy
- Decision -> Action nên replace layer, không nested stack sâu.
- Reflection là focused post-completion modal.
- Modal body scroll; actions luôn reachable.

## Reflection
Visual riêng chưa khóa trong mockup pack, nhưng implementation dùng canonical Modal:
- Done -> Action thành Done trước.
- Reflection outcomes config-driven.
- Reflection optional.
- Undone không xóa reflection lịch sử.
- Done lại prefill reflection gần nhất và tạo completion cycle mới.

---

# 6. Responsive contract

### Desktop
- Main workspace + sticky Summary.
- Bounded selection panel.
- Sidebar ~212px.

### <=58rem
- Main + summary collapse hợp lý; summary inline/collapsible.

### <=42rem
- Single-column.
- Summary thành sticky collapsible bottom summary/bottom sheet.
- Family filter horizontal scroll hoặc compact wrap.
- CTA reachable khi keyboard mở.
- Need/Context info dùng tap.

### <=27rem
- Giảm padding bằng token, không scale UI.
- Selection tiles 1–2 columns.
- VN/EN labels wrap an toàn.

---

# 7. Product/data rules UI MUST NOT break

- Primary Emotion required.
- Intensity required cho completed Emotion.
- Emotion Note optional.
- Unknown Note required; Unknown không có Intensity.
- Secondary max 2; không duplicate; không bằng Primary.
- Need max 3.
- Context max 2.
- Unknown completed tính count + streak nhưng không Orb.
- Unknown -> Emotion giữ provenance `origin_mode = unknown` hoặc tương đương.
- History sort `created_at DESC`.
- Edit không đổi `created_at`.
- Action là canonical object.
- 1 Action tối đa 1 current Check-in link.
- 1 Check-in tối đa 2 active Actions.
- Home và History dùng cùng Orb aggregation capability.
- Emotion Orb contribution weight theo intensity.
- Unknown prompt color chỉ presentation.
- Delete Check-in có Action không silent cascade.

---

# 8. Implementation order

1. Hoàn thiện semantic token layer.
2. Map legacy root variables sang token mới mà không đổi Home approved visual.
3. Normalize/extract Button, Surface, Modal, SegmentedControl, SelectionTile, Input/Textarea.
4. Build Check-in shell/layout primitives.
5. Landing.
6. Primary + Summary.
7. Decision Modal.
8. Deepening steps.
9. Review.
10. Unknown.
11. Action modal/full picker behavior.
12. History + Detail.
13. Responsive.
14. Regression + hosted acceptance.

Không one-shot CSS rewrite toàn app.

---

# 9. Suggested change map

```text
src/
  app/styles/
    tokens.css
    primitives.css
  components/ui/
    Button.tsx
    Surface.tsx
    Modal.tsx
    SegmentedControl.tsx
    SelectionTile.tsx
    StickySummary.tsx
    StepProgress.tsx
  features/checkin/
    pages/
      CheckinLanding.tsx
      CheckinEmotion.tsx
      CheckinUnknown.tsx
      CheckinHistory.tsx
    components/
      EmotionFamilyFilter.tsx
      EmotionGrid.tsx
      IntensitySelector.tsx
      CheckinSummary.tsx
      DecisionModal.tsx
      DeepeningStep.tsx
      ReviewCheckin.tsx
      ActionPickerModal.tsx
      CheckinHistoryList.tsx
      CheckinDetail.tsx
    styles/
      checkin.css
```

Nếu repo naming khác, không ép rename toàn bộ. Reuse existing domain/store/repository code.

---

# 10. QA / acceptance checklist

### Visual
- [ ] Cùng DNA với approved Home.
- [ ] Không mascot.
- [ ] Canvas/ink/accent/radius/border/spacing đúng style guide.
- [ ] Standard CTA không gradient.
- [ ] Không giant dashboard rectangle.
- [ ] Không nested cards thừa.

### Flow
- [ ] Landing có Emotion + Unknown + streak + draft resume.
- [ ] Primary có family filter + search + Recent + bounded picker + intensity + note + summary.
- [ ] Primary Lưu mở đúng 3 choices.
- [ ] Secondary/Need/Context giữ note và state.
- [ ] Need/Context có info affordance.
- [ ] Quick Save / Skip / Back đúng semantics.
- [ ] Review jump edit trực tiếp.
- [ ] Unknown prompt change không mất note.
- [ ] Action cancel không complete Check-in.
- [ ] History detail thao tác canonical object.

### Accessibility/state
- [ ] Selected state không chỉ dùng màu.
- [ ] Visible focus.
- [ ] Reduced motion respected.
- [ ] Long VN/EN text không clip.
- [ ] Bounded scroll không gây scroll trap.
- [ ] Error/save failure không làm mất input.

### Data regression
- [ ] Draft không vào History/Streak/Orb.
- [ ] Unknown không góp Orb.
- [ ] `created_at` ordering không đổi sau edit.
- [ ] Home Orb = History Orb cùng range/data.
- [ ] Action sync xuyên Check-in / Reminder / Home.
- [ ] Delete semantics với linked Action đúng.

---

# 11. Hosted acceptance / Vercel target

- GitHub: `katherine205203/SacKySpace`
- Vercel project: `sacky-space`
- Production: `https://sacky-space.vercel.app`
- Supabase frontend env:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`

```bash
npm install
npm run lint
npm run test
npm run build

git status
git add .
git commit -m "feat(checkin): apply Sacky v2 canonical UI system"
git push

# from linked repo if needed
vercel pull --yes --environment=production
vercel build --prod
vercel deploy --prebuilt --prod
```

Do not commit `.env.local` hoặc `.vercel`.

Hosted acceptance:
1. Auth
2. Home visual regression
3. Landing
4. Emotion fast path
5. Deepening
6. Unknown
7. Action create/cancel
8. History + Detail
9. Reminder same-object Action sync
10. Direct route refresh
11. Draft persistence
12. Basic responsive smoke

---

# 12. Mockup authority note

PNG trong `mockups/` khóa composition, density, hierarchy, component family, selection treatment, summary treatment, modal treatment và relationship với Home.

Mockup không override exact reference data, product limits, lifecycle, persistence, Action/Orb semantics, state transition hoặc History ordering.

Nếu sample text/value trong mockup khác runtime data, dùng runtime/reference data thật nhưng giữ visual structure.

---

# Definition of Done

1. 10 visual surfaces được implement theo cùng design system.
2. Product rules Check-in v1.0 vẫn pass.
3. Home không visual regression.
4. Shared UI primitives được reuse.
5. Desktop 16:10 đạt target trước.
6. Responsive cơ bản pass.
7. Lint/test/build pass.
8. Hosted acceptance pass trên đúng production project.
9. Không mất draft/note và không sinh premature completed records.
10. Vercel production deployment healthy.

**END — SẮC KÝ v2 CHECK-IN UI UPDATE SPECIFICATION v1.0**

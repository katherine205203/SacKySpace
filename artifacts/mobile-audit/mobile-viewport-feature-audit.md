# Sắc Ký · Mobile Viewport & Feature Audit

**Ngày audit:** 2026-09-23  
**Phạm vi:** mobile web / responsive webapp của Sắc Ký  
**Trạng thái:** Conditional pass — nền responsive ổn định, còn 2 refinement cần ưu tiên trước khi gọi là mobile-ready hoàn toàn.

## 1. Kết luận điều hành

App hiện có nền mobile khá tốt và không cần cắt các feature cốt lõi chỉ vì chuyển từ desktop sang mobile.

Kết quả capture tự động trên code hiện tại:

| Hạng mục | Kết quả |
| --- | ---: |
| Route/state được kiểm tra | 26 |
| Viewport kiểm tra | 320, 360, 390, 430 CSS px |
| Tổng capture | 104 |
| Document-level horizontal overflow | 0 / 104 |
| Route không có nội dung | 0 / 104 |
| Control bị vượt ra ngoài viewport | 1 |
| Control dưới 40px theo metric tự động | 84 observations |
| Browser error overlay | Không phát hiện |

Hai điểm đáng chú ý:

1. Calendar Diary có date-cell rộng khoảng **33.3px ở 320px**, **39.0px ở 360px** và **43.3px ở 390px**. Chiều cao đạt khoảng 44.8px nhưng chiều rộng chưa đạt touch target 44px ở phần lớn phone viewport.
2. Rich-text toolbar trong Diary editor ở 320px có control “Đường phân cách” nằm từ `x=289` đến `x=333`, trong khi viewport kết thúc ở `x=320`. Control này vẫn có thể tiếp cận bằng horizontal scroll của toolbar, nhưng không lộ ra ngay khi mở màn hình.

Vì vậy, khuyến nghị hiện tại là:

- **Giữ toàn bộ core journey:** Auth, Home, Check-in, Diary, Journey, Action Space, Future Letter và Gift.
- **Không cắt feature theo kiểu desktop/mobile.** Thay vào đó, progressive disclosure cho các phần nâng cao.
- **Ưu tiên sửa touch target của Diary calendar.**
- **Đơn giản hóa rich-text toolbar trên mobile:** nhóm cơ bản hiển thị trước; nhóm nâng cao nằm trong “Thêm” hoặc có affordance rõ ràng cho horizontal scroll.

## 2. Phạm vi và phương pháp

### Viewport matrix

| Viewport | Mục đích |
| --- | --- |
| 320px | Điện thoại nhỏ, kiểm tra ngưỡng hẹp nhất |
| 360px | Android nhỏ / viewport phổ biến |
| 390px | iPhone hiện đại, viewport đại diện chính |
| 430px | iPhone Pro Max / Android lớn |

### Route/state coverage

| Nhóm | Route/state đã kiểm tra |
| --- | --- |
| Auth | Login / empty authenticated fixture |
| Home | `/` |
| Check-in | Landing, emotion, unknown, secondary emotions, needs, contexts, review, history |
| Diary | Today, editor, read, history |
| Journey | Landing, setup |
| Action Space | Today, history/timeline |
| Future Letter | Landing, write, trigger, decorate, preview, history |
| Gift | Landing, history |
| More | `/more` |

### Cách thu thập evidence

- Chạy Vite local trên `127.0.0.1:5173`.
- Dùng `agent-browser` với fixture browser-only để mô phỏng authenticated user và empty API response; fixture không đọc hoặc ghi dữ liệu thật.
- Chụp full-page screenshot ở cả 4 viewport.
- Đo `document.scrollWidth`, `body.scrollWidth`, bounding box của toàn bộ element và kích thước của button/link/input/select/textarea.
- Kiểm tra browser có render nội dung và không xuất hiện framework error overlay.
- Review trực quan thêm các state populated có ý nghĩa: rich-text focus mode và Future Letter condition builder.

## 3. Tổng quan responsive

### Điểm đã làm tốt

- Mobile shell có top bar và bottom navigation cố định, phù hợp với thao tác bằng một tay.
- Nội dung chính có safe-area padding và bottom padding để tránh bị bottom navigation che.
- Các flow tập trung như Check-in, Diary editor và Future Letter có mobile top bar riêng, back action rõ ràng.
- Các card lớn chuyển thành single-column; không còn layout desktop dạng rail/side-by-side gây bóp hẹp nội dung.
- Các primary CTA phần lớn đạt chiều cao khoảng 44px và dễ nhận biết.
- Ảnh, SVG, canvas và module container có `max-width: 100%`; không phát hiện document scroll ngang.
- Toolbar/tabs có cơ chế horizontal scrolling ở những nơi nội dung không nên wrap vô hạn.

### Lưu ý khi đọc metric

Metric ghi nhận 202 DOM element geometry “lớn hơn viewport”, nhưng toàn bộ document vẫn giữ `scrollWidth === innerWidth`. Phần lớn là path/SVG hoặc landscape illustration của Future Letter được cố ý clip bên trong card; đây không phải lỗi horizontal scroll của trang.

## 4. Feature decision matrix

| Feature | Quyết định trên mobile | Cách hiển thị nên giữ | Có cần cắt scenario? |
| --- | --- | --- | --- |
| Auth | **Giữ nguyên** | Form đơn cột, CTA full width, không thêm bước không cần thiết | Không |
| Home | **Giữ nguyên + stack** | Orb, CTA Check-in, Diary, Action và các personal surfaces theo thứ tự ưu tiên | Không; phần “Dành cho mình” có thể nằm dưới fold |
| Check-in | **Giữ nguyên flow** | Step-by-step, một câu hỏi chính mỗi màn hình, sticky footer | Không; đây là core journey |
| Check-in History | **Giữ nguyên** | Filter/metric phía trên, list và drawer thành bottom sheet | Không; history giúp recovery và revisit |
| Diary Today | **Giữ nguyên** | Empty state và CTA “Bắt đầu viết” nổi bật | Không |
| Diary Editor | **Giữ nguyên nhưng progressive disclosure** | Focus mode cho viết; prompt, emotion, check-in, image là section phụ | Không cắt; nên collapse hoặc reorder phần phụ |
| Diary Read | **Giữ nguyên** | Đọc một cột, metadata dưới nội dung | Không |
| Diary History | **Giữ nguyên + sửa calendar target** | Calendar tháng, chọn ngày, “Viết bù” | Không; sửa touch target |
| Journey | **Giữ nguyên, thiên về wizard** | Setup → chọn đoạn → kết quả; tránh hiển thị nhiều rail đồng thời | Không; giữ như retrospective task |
| Action Space | **Giữ nguyên** | Default vào “Hôm nay”, history là secondary tab | Không; không cần dashboard desktop riêng |
| Future Letter | **Giữ nguyên** | Write → Decorate → Trigger → Preview → Read | Không |
| Future Letter condition builder | **Giữ nguyên nhưng thu gọn** | Category picker dạng sheet/list; group đang cấu hình hiển thị summary | Không cắt; đây là feature differentiator nhưng không nên dồn mọi chi tiết lên một màn hình |
| Gift for Tomorrow | **Giữ nguyên** | Một CTA chính cho câu hỏi hoặc lời nhắn; history ở tab phụ | Không |
| More | **Giữ nguyên như gateway** | Điều hướng Future Letter, Gift và Settings/Profile | Không |
| Admin / Global Admin | **Không coi là mobile user journey** | Desktop-first control plane; nếu cần mobile admin, audit riêng | Có thể defer mobile optimization |

## 5. Findings chi tiết

### F-01 · Diary calendar date-cell chưa đạt touch target ngang

**Priority:** P1  
**Area:** Diary History  
**Evidence:**

- 320px: date-cell khoảng **33.3 × 44.8px**.
- 360px: khoảng **39.0 × 44.8px**.
- 390px: khoảng **43.3 × 44.8px**.
- 430px: khoảng **49.0 × 44.8px**.

Screenshot: [Diary history · 320px](/Users/katherinebui/Documents/SacKySpace/artifacts/mobile-audit/diary-history/320.png)

**Tác động:** Date-cell vẫn dùng được bằng tap nhưng biên độ ngang hẹp ở 320–390px, đặc biệt khi người dùng chọn các ngày nằm sát nhau. Calendar header controls đã đạt 44px; vấn đề chỉ nằm ở grid date-cell.

**Khuyến nghị:**

- Đặt date-cell `min-width: 44px; min-height: 44px`.
- Nếu không đủ chiều rộng ở 320px, giảm horizontal padding của calendar hoặc đổi sang layout ngày dạng list/agenda ở viewport rất nhỏ.
- Không giảm font để “nhét” thêm ngày; ưu tiên hit area.

**Acceptance criteria:**

- Mọi date-cell tương tác có bounding box tối thiểu 44×44px ở 320, 360 và 390px.
- Calendar vẫn không làm `document.scrollWidth` lớn hơn `innerWidth`.

### F-02 · Rich-text advanced toolbar control nằm ngoài vùng nhìn đầu tiên ở 320px

**Priority:** P2  
**Area:** Diary editor / focus writing  
**Evidence:**

- Toolbar container ở 320px: `x=33`, `width=254`, kết thúc tại `x=287`.
- Button “Đường phân cách”: `x=289`, `right=333`, vượt viewport 320px.
- Toolbar có `overflow-x: auto`, nên control không bị mất hoàn toàn; người dùng cần swipe ngang.

Screenshot: [Diary editor · 320px](/Users/katherinebui/Documents/SacKySpace/artifacts/mobile-audit/diary-editor/320.png) và [Focus writing · 390px](/Users/katherinebui/Documents/SacKySpace/artifacts/mobile-audit/diary-editor-focus-390.png)

**Tác động:** Không block việc viết, nhưng user khó biết còn control ở bên phải. Trên mobile, toolbar đầy đủ có quá nhiều chức năng so với không gian nhìn.

**Khuyến nghị:** Chọn một trong hai hướng:

1. Toolbar mobile mặc định chỉ hiển thị Bold, Italic, List và Quote; các chức năng H1–H4, indent, divider, color, font size, emoji nằm trong nút “Thêm”.
2. Giữ horizontal scroll nhưng thêm fade/chevron hoặc label “Vuốt để xem thêm”, đồng thời đảm bảo control cuối không bị cắt một phần.

### F-03 · Diary editor là flow dài, cần ưu tiên “write first”

**Priority:** P2 — product/UX refinement, không phải lỗi responsive blocking  
**Evidence:**

- Capture 320px có chiều cao **2,952px**.
- Các section phụ gồm prompts, emotion, check-in links, images và summary xuất hiện nối tiếp.

Screenshot: [Diary editor · 320px](/Users/katherinebui/Documents/SacKySpace/artifacts/mobile-audit/diary-editor/320.png)

**Tác động:** Người dùng phải scroll rất dài để tới CTA cuối. Điều này phù hợp với một editor đầy đủ nhưng chưa tối ưu cho hành vi “mở app và viết nhanh”.

**Khuyến nghị:**

- Trên mobile mở editor ở Focus mode hoặc đưa “Tiêu đề + Tổng quan” lên đầu rõ hơn.
- Các section phụ mặc định collapsed sau khi người dùng đã có nội dung chính.
- Giữ sticky bottom actions “Lưu nháp” và “Hoàn tất nhật ký”.
- Có thể thêm mini section index: Tổng quan · Prompt · Cảm xúc · Check-in · Ảnh.

### F-04 · Check-in Review dài nhưng không nên cắt

**Priority:** P2 — giữ feature, cải thiện navigation  
**Evidence:**

- Capture 320px có chiều cao **2,402px**.
- Review hiển thị 7 nhóm thông tin theo thứ tự dọc.

Screenshot: [Check-in review · 320px](/Users/katherinebui/Documents/SacKySpace/artifacts/mobile-audit/checkin-review/320.png)

**Tác động:** Đây là flow xác nhận trước khi lưu; nếu cắt bớt nhóm sẽ làm giảm khả năng kiểm tra dữ liệu. Vấn đề là scroll distance, không phải feature thừa.

**Khuyến nghị:**

- Giữ toàn bộ 7 nhóm.
- Cho phép tap vào từng nhóm để mở inline edit.
- Có sticky “Lưu check-in” cuối màn hình hoặc bottom action bar.
- Không biến Review thành một modal nhỏ; modal sẽ làm mất context trên phone.

### F-05 · Future Letter condition builder nhiều thông tin nhưng nên giữ

**Priority:** P2 — progressive disclosure  
**Evidence:** Populated condition builder ở 390px hiển thị category picker, condition group, condition item, step navigation và preview summary trong cùng flow.

Screenshot: [Future Letter trigger populated · 390px](/Users/katherinebui/Documents/SacKySpace/artifacts/mobile-audit/future-letter-trigger-populated-390.png)

**Tác động:** Đây là một feature nâng cao, nhưng không nên cắt trên mobile vì nó là lý do sử dụng Future Letter. Cần giảm cảm giác “form dài”, không giảm capability.

**Khuyến nghị:**

- Category picker mở bằng sheet hoặc list có mô tả ngắn.
- Mỗi group hiển thị summary khi đã cấu hình; chỉ mở detail khi chỉnh sửa.
- Giữ step navigation 1–4, nhưng active step phải dễ nhận biết hơn ở 320px.
- Giữ CTA cuối flow full width.

## 6. Đánh giá theo user journey

### Journey A — Mở app và ghi nhận cảm xúc

**Kết luận:** Giữ nguyên.

1. Mở Home.
2. Tap “Check-in ngay”.
3. Chọn cảm xúc chính.
4. Có thể bỏ qua hoặc đi qua cảm xúc phụ, nhu cầu, bối cảnh.
5. Review và lưu.

Flow này phù hợp mobile vì mỗi bước có một câu hỏi chính. Không cần gộp nhiều bước vào một màn hình để giảm route count; gộp sẽ làm màn hình nặng hơn.

### Journey B — Viết Diary nhanh

**Kết luận:** Giữ nguyên capability, rút ngắn first-use path.

Mobile nên ưu tiên:

1. Tạo tiêu đề.
2. Viết tổng quan.
3. Lưu nháp hoặc hoàn tất.

Prompt, cảm xúc, check-in link và hình ảnh nên là enrichment sau đó. Không nên bắt user đi qua tất cả section để hoàn tất một bài viết tối thiểu.

### Journey C — Tạo Future Letter

**Kết luận:** Giữ nguyên 4 bước, không cắt.

Write, Decorate, Trigger và Preview đã có mental model tốt cho mobile. Cần làm condition builder và toolbar theo kiểu “mở khi cần” thay vì loại bỏ.

### Journey D — Tạo Action và Gift

**Kết luận:** Giữ nguyên.

Action Space có CTA tạo action rõ và default “Hôm nay”; Gift có CTA câu hỏi/lời nhắn rõ. History nên giữ ở secondary view, không cần đưa toàn bộ history lên landing.

### Journey E — Điều hướng các khu vực ít dùng

**Kết luận:** More page là lựa chọn đúng.

Bottom nav chỉ giữ 5 item thường dùng; Future Letter và Gift đi qua More. Đây là trade-off hợp lý để tránh bottom nav 7–8 item quá nhỏ. [More · 390px](/Users/katherinebui/Documents/SacKySpace/artifacts/mobile-audit/more/390.png)

## 7. Khuyến nghị cắt, giữ và defer

### Nên giữ trên mobile

- Login.
- Home overview và Check-in CTA.
- Toàn bộ Check-in flow.
- Diary create, autosave/draft, read và history.
- Journey setup/read.
- Action create, complete và history.
- Future Letter write, decorate, trigger, preview, read và history.
- Gift question/message, send flow và history.
- More gateway.

### Nên adapt trên mobile

- Diary editor: focus-first, optional sections collapsed.
- Diary calendar: tăng touch target.
- Rich-text toolbar: basic-first, advanced in overflow/sheet.
- Future Letter trigger: summary groups và sheet cho category.
- Check-in Review: giữ toàn bộ dữ liệu nhưng thêm sticky action và inline edit.

### Có thể defer mobile-specific optimization

- Admin Studio / Global Admin.
- Settings/Profile, hiện đang là placeholder “Sắp có”.
- Landscape-specific composition; hiện audit mới tập trung portrait phone.

### Không nên cắt chỉ vì màn hình nhỏ

- History và Review: đây là cơ chế kiểm tra, recovery và tạo niềm tin.
- Future Letter trigger: feature nâng cao nhưng có giá trị cốt lõi.
- Diary image slots: nên giữ 4 slots nhưng cho phép bỏ qua.

## 8. Backlog đề xuất

| ID | Priority | Task | Effort | Done when |
| --- | --- | --- | --- | --- |
| MOB-01 | P1 | Tăng date-cell Diary calendar lên 44×44px ở 320–390px | S | Không date-cell nào dưới 44×44px |
| MOB-02 | P2 | Thiết kế basic/advanced mode cho rich-text toolbar | M | Advanced controls không bị cắt khó hiểu; vẫn truy cập được |
| MOB-03 | P2 | Focus-first layout cho Diary editor trên mobile | M | Viết và lưu nháp không cần scroll qua toàn bộ enrichment sections |
| MOB-04 | P2 | Collapsible groups cho Future Letter condition builder | M | Group summary và edit detail rõ ở 320/390px |
| MOB-05 | P2 | Sticky/section navigation cho Review và Diary editor | M | CTA không bị mất sau long scroll |
| MOB-06 | P3 | Audit landscape và real iOS Safari | M | Có evidence cho 568×320, 667×375 và keyboard states |
| MOB-07 | P3 | Audit populated live data bằng account test | M | Xác nhận drawer, images, history và error states với dữ liệu thật |

## 9. Acceptance criteria cho vòng responsive tiếp theo

- `document.documentElement.scrollWidth === window.innerWidth` tại tất cả route/state mobile.
- Tất cả primary action và date-cell tương tác đạt tối thiểu 44×44px.
- Không có control quan trọng bị cắt một phần khi màn hình vừa mở.
- Bottom navigation không che CTA hoặc field đang active.
- Diary editor có thể viết và lưu nháp với một đường đi ngắn, không bắt buộc mở enrichment sections.
- Future Letter condition builder vẫn đủ capability trên mobile nhưng không hiển thị tất cả detail đồng thời.
- Check-in Review vẫn cho phép kiểm tra và sửa từng phần trước khi lưu.
- Error/loading/empty states có nội dung và CTA rõ ở 320px.

## 10. Giới hạn của audit

- Fixture dùng empty API response; chưa xác nhận toàn bộ populated live-data drawer và persistence với account thật.
- Chưa mô phỏng chính xác iOS Safari keyboard, dynamic viewport khi keyboard mở, orientation change và safe-area thật trên thiết bị.
- Chưa đo performance theo mạng 3G/4G, cold cache, memory và image upload thực tế.
- Chưa audit mobile cho Global Admin/Admin Studio; đây nên là một workstream riêng vì information architecture và quyền thao tác khác user app.

## 11. Evidence index

- [Full mobile audit report cũ / baseline](/Users/katherinebui/Documents/SacKySpace/artifacts/mobile-audit/final-audit-report.md)
- [Metrics JSON — 104 captures](/Users/katherinebui/Documents/SacKySpace/artifacts/mobile-audit/metrics.json)
- [Repeatable audit script](/Users/katherinebui/Documents/SacKySpace/scripts/mobile-audit.mjs)
- [Home · 390px](/Users/katherinebui/Documents/SacKySpace/artifacts/mobile-audit/home/390.png)
- [Check-in emotion · 390px](/Users/katherinebui/Documents/SacKySpace/artifacts/mobile-audit/checkin-emotion/390.png)
- [Diary editor · 320px](/Users/katherinebui/Documents/SacKySpace/artifacts/mobile-audit/diary-editor/320.png)
- [Diary history · 320px](/Users/katherinebui/Documents/SacKySpace/artifacts/mobile-audit/diary-history/320.png)
- [Action Space · 390px](/Users/katherinebui/Documents/SacKySpace/artifacts/mobile-audit/action-space/390.png)
- [Future Letter populated condition builder · 390px](/Users/katherinebui/Documents/SacKySpace/artifacts/mobile-audit/future-letter-trigger-populated-390.png)
- [Gift · 390px](/Users/katherinebui/Documents/SacKySpace/artifacts/mobile-audit/gift/390.png)
- [More · 390px](/Users/katherinebui/Documents/SacKySpace/artifacts/mobile-audit/more/390.png)


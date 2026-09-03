# SẮC KÝ — UI REFRESH & ADMIN STUDIO UI CONTENT
## Codex Handoff v1.1

Tài liệu này chốt lại các chỉnh sửa UI/UX mới nhất theo feedback hiện tại.

## 1. Mục tiêu
- Làm UI vivid hơn, bớt cảm giác webapp demo.
- Chốt Color Territory cho Home hero.
- Chuẩn hóa Action UX giữa Home, Check-in, Action Space.
- Thiết kế lại reflection modal.
- Làm Future Letter landing vivid hơn.
- Thêm capability UI Content trong Admin Studio.

## 2. Quyết định đã chốt

### 2.1 Color Territory
- Giữ layout Home hero hiện tại, chỉ thay visual orb.
- Dùng **Color Territory** thay cho orb blur cũ.
- Territory dùng **hex color thật** từ dữ liệu.
- Màu phải vivid, rõ, không wash-out.
- Ưu tiên 2–4 territory chính.
- Territory lớn nhất = màu có tỷ trọng lớn nhất trong kỳ đang xem.
- Nếu không có dữ liệu: hiển thị empty orb trung tính, không fake territory.

### 2.2 Header consistency
- Check-in, Diary, Action Space, Future Letter, Gift for Tomorrow dùng cùng hệ spacing cho header.
- Fix lệch top margin giữa Check-in và Diary.

### 2.3 Màu & contrast
- Accent color, badge, CTA, icon accent phải vivid hơn.
- Tránh màu quá nhạt, thiếu contrast.

## 3. Theo module

### 3.1 Home
- Hero giữ layout, chỉ thay orb bằng Color Territory.
- Section **Việc nhỏ chăm mình** phải hiện full action lite card, không chỉ là dòng redirect.
- Nếu không có action: vẫn có placeholder trắng, chiều cao chạm bằng hero/grid tương ứng.
- Nếu action quá nhiều: scroll nội bộ phần list.
- Home action card cần có: tick done, title, note nếu có, badge nguồn, accent color, metadata cần thiết.
- Nếu action từ check-in: dùng emoji và hex color từ check-in.
- Fix bug state mâu thuẫn: đang hiện “1 việc chưa lên lịch” nhưng body lại báo empty.

### 3.2 Check-in
- Fix header spacing.
- Action card cuối flow Check-in giữ hướng hiện tại nhưng giảm ratio/card height một chút.
- Action liên kết check-in phải dùng emoji của check-in.

### 3.3 Action Space
- Card gọn hơn một chút.
- Bắt buộc có: Tên, Description/Note nếu có, Badge nguồn, Quick Done CTA.
- Action độc lập: visual mặc định + accent tím.
- Action từ check-in: emoji check-in + badge “Từ Check-in” + accent color theo hex.

### 3.4 Reflection Modal
- Bố cục 2 phần: trái = context summary, phải = interaction.
- Trái: emoji/icon, tên VI, tên EN (nếu từ check-in), source rõ ràng.
- Phải: 5 trạng thái: Ổn hơn / Thoải mái hơn nhiều / Không có gì khác biệt / Tệ hơn / Khác.
- Có optional note.
- CTA rõ ràng.
- Màu highlight vivid hơn.

### 3.5 Future Letter
- Landing cần vivid hơn, có hero mạnh hơn.
- Học tinh thần visual delight từ Gift for Tomorrow.
- Giữ flow: Viết → Trang trí → Xem lại → Niêm phong.

### 3.6 Admin Studio — UI Content
- Thêm capability chỉnh UI copy/content để text không hard-code.
- Các text ví dụ: “Khoảng màu hiện tại”, “Hành trình gần đây”, “Dành cho mình”, “Check-in ngay”, “Hôm nay là một ngày mới, hãy lắng nghe mình nhé.”
- Cấu trúc: **Module → Screen → Element**.
- Save = apply ngay.
- Nên có search/filter, audit log, reset default, import/export nếu không quá phức tạp.
- Fallback: nếu chưa có config thì app dùng default copy trong code.

## 4. Đề xuất data model cho UI Content
| Field | Ý nghĩa |
|---|---|
| module_key | Ví dụ: home, checkin, diary, action_space |
| screen_key | Ví dụ: home_dashboard, checkin_landing |
| element_key | Ví dụ: hero_title, hero_subtitle, primary_cta_label |
| text_vi | Nội dung tiếng Việt |
| text_en | Nội dung tiếng Anh (optional) |
| description | Ghi chú nội bộ |
| is_active | Bật/tắt |
| updated_by / updated_at | Audit cơ bản |

## 5. Acceptance Criteria
- Home hero đã dùng Color Territory mới.
- Territory map từ hex color thật.
- Empty state của orb đúng.
- Check-in và Diary header hết lệch.
- Home action section giữ đúng chiều cao grid và empty state đúng.
- Home action section hiện full lite card.
- Action Space card hiện đủ info và đúng mapping nguồn/màu/emoji.
- Reflection modal mới rõ ràng, đủ 5 trạng thái, note và CTA.
- Future Letter landing vivid hơn.
- Admin Studio UI Content hoạt động với save-apply ngay và fallback default.

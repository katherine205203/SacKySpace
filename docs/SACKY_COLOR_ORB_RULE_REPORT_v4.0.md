# Sắc Ký — Color Orb Rule Report

## v4.0 · 12/09/2026

### Mục đích

Report này ghi lại rule dữ liệu và rule hiển thị Color Orb đang có trong codebase. Nó tách riêng phần tính “màu hiện diện” khỏi renderer để việc kiểm tra sản phẩm không nhầm giữa công thức dữ liệu và cách vẽ orb.

### Nguồn đối chiếu

- `src/features/home/services/homeAggregation.ts`
- `src/features/checkin/utils/colorOrb.ts`
- `src/features/home/components/HomeOrb.tsx`
- `src/features/home/components/HomeHero.tsx`
- `src/features/checkin/utils/colorOrb.test.ts`

## 1. Rule dữ liệu

### Record được tính

Chỉ `emotion` check-in có `primaryEmotion` mới đóng góp vào Color Orb. `unknown` check-in bị loại khỏi danh sách màu; chúng vẫn có thể được dùng cho streak và metric khác.

### Một check-in chỉ có một tổng trọng số

Trọng số tổng của một check-in được tính từ intensity. Secondary emotion không tạo thêm trọng số mà chỉ chia lại tổng trọng số đó.

| Intensity | Presence weight |
| ---: | ---: |
| 1 | 1.00 |
| 2 | 1.35 |
| 3 | 1.80 |
| 4 | 2.40 |
| 5 | 3.20 |

Intensity được làm tròn và giới hạn trong khoảng 1–5 trước khi tra bảng.

### Chia primary / secondary

| Cấu trúc check-in | Primary | Secondary A | Secondary B | Secondary C |
| --- | ---: | ---: | ---: | ---: |
| Không có secondary | 100% | — | — | — |
| Có 1 secondary | 70% | 30% | — | — |
| Có 2 secondary | 70% | 15% | 15% | — |
| Có 3 secondary | 70% | 10% | 10% | 10% |

Secondary trùng primary bị loại. Secondary trùng nhau cũng chỉ giữ một bản ghi đầu tiên. Tổng contribution sau khi chia vẫn bằng đúng presence weight của check-in.

### Tổng hợp và phần trăm

Các contribution được group theo `emotionId` nếu có; nếu không có thì group theo màu hex đã chuẩn hóa. Sau đó cộng dồn weight và tính:

`percentage = emotion_weight / total_weight × 100`

Kết quả được giữ nguyên qua các range Home (Hôm nay, Tuần này, Tháng này, Tùy chọn); range chỉ quyết định tập record đầu vào.

## 2. Rule màu

- `emotion.color_hex` là nguồn màu gốc.
- Hex được normalize về dạng `#RRGGBB` viết hoa; mã 3 ký tự được mở rộng.
- Mã màu không hợp lệ có fallback kỹ thuật `#B8A5DF`.
- Không thêm màu tím phủ toàn cục và không làm mất màu hex gốc trong vùng lõi của emotion.

## 3. Rule sắp xếp màu

Color Orb dùng OKLab để đo khoảng cách màu cảm nhận (`colorDistance`). Sau khi sort theo presence weight giảm dần, các entry được nối tiếp bằng entry còn lại gần nhất với màu trước đó. Stable hash của key chỉ dùng để phá hòa, giúp kết quả ổn định giữa các lần render.

Đây là rule sắp xếp thị giác, không phải rule nhóm ngữ nghĩa: mỗi emotion vẫn là một entry riêng.

## 4. Hai renderer hiện có

### Field renderer — `CHECKIN_BLEND_ORB`

Đây là renderer mặc định hiện tại (`HOME_ORB_RENDERER`). Nó tạo weighted field dạng Voronoi hữu cơ trên canvas:

- seed cố định theo số lượng entry, cộng jitter ổn định theo key;
- warp tọa độ dùng noise tần số thấp để làm biên cong tự nhiên;
- field bias được calibrate trên lưới tròn để diện tích vùng bám gần presence weight;
- chỉ blend trong dải biên hẹp giữa hai vùng, màu lõi giữ hex gốc.

Các rule này vẫn được test trong `colorOrb.test.ts`.

### Halo Ring — `HALO_RING`

Đây là renderer Halo Ring đã được triển khai song song:

- mỗi emotion nhận một arc có span đúng theo `weight / totalWeight`;
- các arc được sắp theo color affinity;
- gradient dùng `conic-gradient`;
- transition rộng hơn khi hai màu gần nhau trong OKLab, hẹp hơn khi màu cách xa;
- hit testing dùng `start/end` của arc gốc, không dựa trên màu pixel đã blend;
- hover/click/keyboard có tooltip, chọn arc, click ngoài và Escape để bỏ chọn.

`start/end` quyết định vùng dữ liệu và interaction; transition chỉ mở rộng phần chuyển màu thị giác, không đổi ownership hay phần trăm của arc.

### Trạng thái hiện tại

Codebase đang hỗ trợ cả hai renderer, nhưng Home mặc định hiện là `CHECKIN_BLEND_ORB`. Muốn dùng Halo Ring ở một instance cần truyền `renderer="HALO_RING"` vào `HomeOrb`. Đây là điểm cần thống nhất nếu Halo Ring được xem là canonical renderer của product.

## 5. Legend và interaction

- Legend Home lấy tối đa 3 emotion có contribution lớn nhất, sort giảm dần.
- Mỗi dòng gồm color dot, emoji, tên tiếng Việt và phần trăm.
- Halo Ring hỗ trợ hover, focus bằng keyboard, arrow keys để chuyển arc, Enter/Space để pin, click ngoài hoặc Escape để clear.
- Tooltip hiển thị emotion, English label nếu có và `% hiện diện`.
- Arc nhỏ không bị xóa khỏi dữ liệu; renderer readable chỉ giới hạn inline label, không loại bỏ territory.

## 6. QA invariants

Các test hiện có xác nhận:

1. Mapping intensity là `[1, 1.35, 1.8, 2.4, 3.2]`.
2. Kết quả field deterministic với cùng input.
3. Primary/secondary giữ đúng tổng weight.
4. Vùng màu dominant chiếm diện tích lớn hơn vùng nhỏ hơn và tổng diện tích gần đúng tỷ lệ weight.
5. Màu hex thật được giữ ở core và blend chỉ xuất hiện ở shared boundary.
6. Halo arc giữ đủ emotion nhỏ, tổng span bằng 100%, gradient stop nằm trong 0–100%.
7. Hai màu gần nhau có transition rộng hơn hai màu xa nhau.

## 7. Kết luận / việc cần quyết định

Rule dữ liệu hiện nhất quán với handoff Color Halo Ring v3.0. Điểm còn cần quyết định ở cấp product là renderer mặc định: giữ field renderer hiện tại, hoặc đổi `HOME_ORB_RENDERER` sang `HALO_RING` sau khi duyệt visual trên các range và kích thước responsive.

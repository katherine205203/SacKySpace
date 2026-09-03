# SẮC KÝ v2 — CHECK-IN LANDING REDESIGN
## Codex Implementation Guideline v1.0

**Visual authority:** `pastel_vietnamese_wellness_check_in_dashboard.png`  
**Priority viewport:** MacBook 13.3-inch, 2560×1600, 16:10 desktop composition.

> Important: the approved reference image may still show sidebar icons. The actual implementation must follow the newer global rule: **remove all module icons in sidebar and remove the Admin Studio icon**.

## 1. Canonical layout

1. Shared page heading + restrained `Lịch sử check-in` entry at top right.
2. Large hero / gentle streak-gamification zone.
3. Two equal mode cards: Emotion Check-in / Unknown Check-in.
4. Compact `Hoạt động gần đây` strip with latest 3 items and `Xem tất cả`.

## 2. Remove from current UI

- Remove old mode checklist bullets (`Chọn cảm xúc chính`, `Chọn cường độ`, etc.).
- Remove `Bạn luôn có thể chỉnh sửa check-in sau khi lưu.`
- Do not keep a visually loud recommendation badge unless actual recommendation logic needs it.

## 3. Hero / gamification

- Use canonical Check-in streak logic.
- Suggested supported metrics: current streak, today state, total/period check-in count.
- Gentle, non-punitive. No productivity score.
- Hero orb should be runtime-generated with CSS/SVG/Canvas or existing orb renderer. **No new bespoke asset required.**

## 4. Orb visual

- Vivid, clean, separated pigments.
- Avoid muddy heavy blur.
- Prefer controlled layered radial gradients / translucent blobs / vector rings.
- Emotion state uses actual emotion/check-in pigments.
- Neutral state uses clean soft-violet/pastel fallback.

## 5. Mode cards

### Emotion Check-in
- Short explanation only.
- One primary CTA.
- Small code-generated orb visual.

### Unknown Check-in
- Short explanation only.
- One primary CTA.
- Code-native writing/prompt motif; no custom asset dependency.

## 6. History / recent activity

- Top-right `Lịch sử check-in` = canonical History entry.
- Bottom `Hoạt động gần đây` = latest 3 bounded records.
- `Xem tất cả` routes to the same History page.
- Reuse canonical Check-in records/snapshots.

## 7. Global visual rules

- Primary CTA = solid `#743CFF`, white text.
- No gradient button.
- Shared heading system with Diary / Action Space / Future Letter / Gift.
- Sidebar text-only labels, no module icons.
- Desktop-first.

## 8. Performance

- No full history load on landing.
- Recent activity query is bounded.
- Use shared caches/runtime config.
- Decorative interactions must not trigger DB requests.
- Preserve current local-first/runtime optimizations.

## 9. Acceptance

- Fits MacBook-priority 16:10 desktop view.
- Hero remains one row.
- Two mode cards remain two columns on desktop.
- Recent strip compact.
- No sidebar icons.
- No old checklist/help sentence.
- Code-generated visuals, no new asset requirement.
- Lint/tests/build pass.
- Authenticated screenshots at priority viewport + narrower desktop.

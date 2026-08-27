# UI Reference Index — Check-in v2

These images are reference material for Codex. **CHECKIN_V2_PRODUCT_SPEC.md wins whenever an image contains stale data, an incorrect count, an old label or a behavior that conflicts with the written spec.**

- `ui/00_style_reference_selected.png` — user-selected visual direction: flat, bright, vivid, clean, right-side detail rail.
- `ui/01_landing.png` — Landing composition with Emotion / Unknown modes.
- `ui/02_emotion_core.png` — Primary emotion + family filters + intensity + note + right detail rail.
- `ui/03_saved_decision_modal.png` — post-save 3-option modal.
- `ui/04_secondary_emotion.png` — Secondary Emotion layout. **Correction:** do not add any top summary strip; keep only the right summary rail.
- `ui/05_need.png` — Need selection layout with right summary rail. Use same composition for Context, with Context reference data and max 2.
- `ui/06_review.png` — final Review composition.
- `ui/07_action_modal.png` — action suggestion + action configuration modal.
- `ui/08_unknown.png` — Unknown prompt + writing layout.
- `ui/09_history.png` — History subtab with filters, scope orb, list and detail drawer.

### Visual implementation overrides

1. Use **flat vivid violet** for brand CTA/selected system controls; generated images may show gradients, but gradients are not the default language.
2. Keep default inventory cards mostly neutral. Use semantic color for icon/accent/tint/selected state rather than filling the entire inventory with saturation.
3. Avoid heavy glass, glow and unnecessary shadows.
4. Color Orb is the intentional multi-color signature visual and should use organic contiguous flat regions.
5. Navigation labels for current v2: Home / Check-in / Diary / Reminder / Future Letter / Gift for Tmr; Admin Studio at bottom. Ignore any old Garden, Statistics, Settings or other sidebar items visible in stale references.

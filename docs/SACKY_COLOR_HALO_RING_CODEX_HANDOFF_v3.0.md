# SẮC KÝ v2 — COLOR ORB UPDATE HANDOFF
## v3.0 — Replace Organic Territory Renderer with Color Halo Ring
**Date:** 03/09/2026  
**Scope:** Home — Light Theme — Color Orb only  
**Target:** Codex implementation handoff

---

# 1. PURPOSE

The current organic-territory Color Orb renderer is rejected.

Multiple correction passes have produced unstable output:
- jagged / pixelated boundaries,
- radial artifacts,
- white cracks,
- malformed wedges,
- excessive blur,
- or one globally blended purple sphere where distinct emotions disappear.

Do **not** continue patching the territory / Voronoi / polygon / field renderer.

The new canonical direction is:

# COLOR HALO RING

A thick circular color ring where:
- arc length reflects emotion presence percentage,
- real emotion `hex_color` remains the color source of truth,
- perceptually similar colors are positioned next to one another,
- adjacent colors blend smoothly into each other,
- there are no hard segment dividers,
- the result feels like a continuous color halo rather than a donut chart.

This replaces the previous organic-territory rendering approach.

---

# 2. PRODUCT LOGIC — KEEP EXISTING APPROVED FORMULA

The visual renderer changes.

The emotion-presence calculation does **not** change.

## 2.1 Eligible records

Include:
- Emotion Check-ins

Exclude:
- Unknown Check-ins from Color Orb

Unknown Check-ins may still count toward other streak/count logic, but they do not contribute color to the Orb.

---

# 3. INTENSITY → PRESENCE WEIGHT

Use the approved non-linear mapping:

| Intensity level | Presence weight |
|---|---:|
| 1 | 1.00 |
| 2 | 1.35 |
| 3 | 1.80 |
| 4 | 2.40 |
| 5 | 3.20 |

Do **not** replace this with linear `1/2/3/4/5`.

---

# 4. PRIMARY / SECONDARY CONTRIBUTION

Every Check-in has only **one total presence weight**.

Secondary emotions distribute that weight; they do not create additional weight.

## No secondary
- Primary = 100%

## One secondary
- Primary = 70%
- Secondary = 30%

## Two secondaries
- Primary = 70%
- Secondary A = 15%
- Secondary B = 15%

## Three secondaries
- Primary = 70%
- Secondary A = 10%
- Secondary B = 10%
- Secondary C = 10%

Hard rules:
- Primary cannot equal Secondary within the same Check-in.
- Secondary emotions have equal weight after the primary 70% share is reserved.
- The sum of contributions for one Check-in must remain equal to that Check-in's total presence weight.

Example:

Intensity 5 → total weight = `3.20`

Primary: Hứng thú  
Secondary: Bình yên + Tò mò

Contribution:
- Hứng thú = `2.24`
- Bình yên = `0.48`
- Tò mò = `0.48`

---

# 5. AGGREGATION

For the selected timeframe:

1. Calculate each Check-in's total presence weight.
2. Distribute weight across Primary / Secondary.
3. Sum contribution by emotion.
4. Normalize all emotion contributions to 100%.

Formula:

`emotion_percentage = emotion_contribution / total_contribution × 100`

Color Orb remains compatible with:
- Hôm nay
- Tuần này
- Tháng này
- Tùy chọn

Do not hard-code the renderer to daily-only data.

---

# 6. NEW CANONICAL VISUAL — COLOR HALO RING

The Orb is now a **thick circular ring**, not a filled-disc territory map.

The ring should visually feel:
- soft,
- vivid,
- continuous,
- refined,
- editorial,
- organic,
- clean.

It must **not** look like:
- a standard donut chart,
- a pie chart,
- separated color blocks,
- striped bands,
- hard wedges,
- segmented progress arcs.

The user should perceive one continuous halo made from several emotion colors.

---

# 7. REAL HEX = SOURCE OF TRUTH

Every emotion uses its actual database `hex_color`.

Do not invent a replacement palette.

Do not globally tint the Orb violet.

Do not wash colors out with:
- white haze,
- excessive opacity,
- gray overlay,
- pastel veil.

The halo may use:
- smooth interpolation,
- local tonal variation,
- edge feathering,
- anti-aliasing,
- subtle luminosity adjustment,

but each emotion must remain visually identifiable from its real hex.

The principle is:

**Hex is the data source; rendering can still be polished.**

---

# 8. COLOR ORDER — SIMILAR COLORS MUST BE NEIGHBORS

Emotion order around the ring must not be random.

Convert emotion colors to a perceptual color space:
- preferably OKLCH,
- alternatively OKLab.

Then arrange colors around the ring so perceptually similar colors are preferentially adjacent.

Example conceptual sequence:

`cyan → blue → blue-violet → violet → pink → coral → orange → yellow → green → mint`

The exact order depends on the day's real colors.

Do not create semantic emotion groups.

This is only a visual ordering rule.

Each emotion remains a distinct data record.

---

# 9. ARC LENGTH = PRESENCE %

Each emotion receives an angular span proportional to its normalized presence percentage.

Example:

- Bối rối = 40%
- Chán = 30%
- Mơ hồ = 9%
- Other emotion A = 12%
- Other emotion B = 9%

The 40% color occupies approximately 40% of the ring circumference.

The visual result should make dominant emotion presence immediately obvious.

Small emotions must remain represented.

Do not drop low-percentage emotions simply because they are visually small.

---

# 10. BLENDING — THE KEY RULE

This is the most important visual rule.

There must be **no hard divider line** between adjacent emotions.

Instead, create a transition zone between neighboring colors.

## Similar colors
If two colors are perceptually close:
- use a wider,
- softer,
- more continuous blend.

Example:
- violet ↔ blue-violet
- yellow ↔ orange
- cyan ↔ blue

These may visually flow almost seamlessly into one another.

## Distant colors
If colors are perceptually far apart:
- use a narrower transition,
- but still avoid a hard line.

Example:
- yellow ↔ violet

The boundary can be clearer, but it must still be anti-aliased and visually smooth.

The core region of each arc must remain strongly identifiable as the original emotion hex.

Do **not** blend every color across the entire ring.

---

# 11. IMPLEMENTATION — PREFER SIMPLE, STABLE TECHNIQUE

This redesign is intentionally chosen because it must be reliable and easy to maintain.

Preferred implementation:

## Option A — CSS `conic-gradient` + radial mask

Recommended first choice.

Pipeline:

`emotion percentages`
→ `perceptual color ordering`
→ `angular spans`
→ `transition stops`
→ `conic-gradient`
→ `radial mask`
→ `halo ring`

Benefits:
- very smooth rendering,
- responsive,
- no polygon geometry,
- no jagged paths,
- no canvas pixel artifacts,
- easy to animate/highlight,
- code-native,
- no asset required.

## Option B — SVG circular gradient

Acceptable if it gives better interaction control.

Do not return to:
- Voronoi,
- weighted polygons,
- smoothed pie wedges,
- influence-field territory maps,
- per-pixel Canvas region rendering.

Those approaches are deprecated for this feature.

---

# 12. RING PROPORTIONS

The ring should be visually substantial.

Target:
- outer radius: normal Orb size
- ring thickness: approximately 30–40% of radius

Avoid:
- thin analytics donut
- extremely thick ring that looks like a filled disc

The inner void should feel intentional and spacious.

The inner center may contain a minimal factual label, for example:

`2`
`Check-ins`

or remain nearly empty if the surrounding Home composition already communicates the count clearly.

Do not overload the center.

---

# 13. EDGE TREATMENT

Outer and inner edges should be:
- smooth,
- anti-aliased,
- slightly softened.

A very subtle 2–6 px feather is acceptable.

Do not create:
- heavy glow,
- blurry fog,
- oversized shadow,
- glassmorphism.

The halo must remain crisp enough for the light theme.

---

# 14. PERCENTAGE LABELS

Inside/on the ring:
- percentage only,
- no emotion name.

Examples:
- `40%`
- `30%`
- `9%`

Only show the label when the arc is large enough for clear placement.

For very small arcs:
- omit the in-ring percentage,
- keep the arc itself,
- expose details through interaction.

Do not force labels into tiny regions.

---

# 15. DOMINANT LEGEND

Outside the ring, keep a simple dominant-emotion legend.

Show only the top 1–3 dominant emotions.

Each row:
- small color dot
- emoji
- `emotion_name_vn`
- percentage

Optional English name may appear in tooltip/detail, not necessarily in the compact Home legend.

Sort descending by percentage.

Do **not**:
- group emotions,
- invent category names,
- summarize into artificial clusters.

---

# 16. INTERACTION — KEEP THE APPROVED MODEL

The Halo Ring remains interactive.

## Desktop hover

Hovering an emotion arc should:
- subtly emphasize that arc,
- slightly de-emphasize other colors if useful,
- show a compact tooltip.

Tooltip content:

`[emoji] emotion_name_vn`  
`emotion_name_en`  
`XX% hiện diện`

Optional factual detail:
- `Primary ở X Check-in`
- `Secondary ở Y Check-in`

Only show counts if they can be derived directly.

Do not add AI interpretation.

---

# 17. CLICK / PIN

Clicking an arc:
- pins the selection,
- keeps tooltip/detail visible.

Selection clears when:
- another emotion is selected,
- user clicks outside,
- Escape is pressed.

This interaction should later translate naturally to touch:
- tap arc → select/show detail.

---

# 18. LEGEND ↔ RING SYNCHRONIZATION

Hover/focus a dominant legend row:
- highlight corresponding arc.

Click a legend row:
- pin corresponding emotion.

Hover/click an arc:
- highlight corresponding legend row if it is one of the visible top 1–3 emotions.

---

# 19. HIT TESTING

Because the rendered gradient is continuous, interaction must still map pointer angle to the underlying emotion arc.

Recommended:

1. Calculate pointer angle relative to Orb center.
2. Normalize angle to `0–360°`.
3. Compare against the source angular ranges before visual blend expansion.
4. Resolve the emotion whose core arc owns that angle.

The interaction model must be based on data arc ranges, not on sampled pixel color.

This prevents ambiguous hit detection inside blend zones.

---

# 20. HOVER VISUAL

Hover/selected state should not change geometry.

Allowed:
- slight saturation increase,
- small brightness increase,
- subtle halo emphasis,
- slight dimming of other arcs.

Not allowed:
- resizing ring segment,
- separating/exploding segment,
- moving arc,
- bouncing,
- pulsing continuously.

The ring should remain one continuous object.

---

# 21. SINGLE-EMOTION STATE

If only one emotion exists:
- entire ring uses that emotion's real hex.

To avoid a dead flat ring, a very subtle same-hue tonal shift may be introduced around the circumference.

Do not add fake secondary colors.

Legend shows one emotion.

---

# 22. EMPTY STATE

If there are zero eligible Emotion Check-ins:

Render a neutral halo:
- very light lavender / neutral tint,
- no fake emotion colors,
- no emotion legend.

Center may say:
`Chưa có màu hôm nay`

or follow current Home empty-state copy from Content Registry.

---

# 23. MANY-EMOTION STATE

Support variable emotion counts.

Do not assume exactly 3 or 5 emotions.

For many small emotions:
- maintain their proportional arcs,
- omit tiny percentage text where needed,
- rely on hover/click detail.

Do not collapse emotions into an "Other" category unless product rules explicitly change later.

---

# 24. LIGHT THEME INTEGRATION

Current Sắc Ký light visual system remains:

- canvas `#F8F6FF`
- surface `#FFFFFF`
- ink `#231B46`
- muted `#625A75`
- violet `#743CFF`
- strong violet `#5326BE`
- soft violet `#ECE4FF`
- border `#E5DDF5`
- font: Be Vietnam Pro

Important:
The Ring itself is not globally purple.

Emotion colors are the visual protagonist.

Do not redesign Home layout in this task.

Only replace the Color Orb visual renderer and make small spacing adjustments if required.

---

# 25. DEPRECATED COLOR ORB APPROACHES

The following are no longer accepted for Home Color Orb:

- organic Voronoi territories
- weighted territory polygons
- pie / donut segmentation with hard cuts
- deformed radial wedges
- influence-field full-disc blend
- global gradient sphere
- blur blobs
- glow balls
- malformed path-based territories

Remove or isolate deprecated renderer code instead of layering the Ring renderer on top of it.

---

# 26. HARD ACCEPTANCE

The new Color Halo Ring is accepted only when all conditions below pass:

1. Ring is a clean continuous circle.
2. No jagged edges.
3. No pixel artifacts.
4. No white cracks.
5. No malformed polygons.
6. No radial wedges.
7. No hard separator lines between emotions.
8. Real emotion hex colors remain recognizable and vivid.
9. Similar colors visually sit next to one another.
10. Similar colors blend more softly.
11. Arc length reasonably reflects presence percentage.
12. Small emotions remain represented.
13. Top 1–3 dominant legend is correct.
14. Hover tooltip works.
15. Click-to-pin works.
16. Legend ↔ ring highlighting stays synchronized.
17. Today / Week / Month / Custom all render correctly.
18. No image asset / PNG / WebP is required.

---

# 27. REQUIRED TEST CASES

Capture and verify at least:

### H1 — Empty
0 Emotion Check-ins.

### H2 — Single emotion
100% one source hex.

### H3 — Two similar colors
Verify strong smooth blend.

### H4 — Two distant colors
Verify narrower but still soft transition.

### H5 — Multi-emotion
At least 5 emotions.

### H6 — Dominant + small
Example:
40% / 30% / 9% / 12% / 9%.

### H7 — Primary + Secondary contribution
Verify 70/15/15 logic.

### H8 — Interactive
One arc hovered/pinned with tooltip.

### H9 — Time range
Switch Today → Week → Month and verify stable rendering.

---

# 28. VERIFICATION WORKFLOW

After implementation:

- run lint
- run relevant tests
- run build

Then capture authenticated desktop screenshots for:

1. multi-emotion ring normal
2. similar-color blend
3. dominant arc hover
4. small arc hover
5. single-emotion state
6. empty state

Do not commit / push / deploy before owner review.

Workflow:

`IMPLEMENT`
→ `VERIFY`
→ `CAPTURE`
→ `STOP`
→ `OWNER REVIEW`
→ `CORRECTION PASS IF NEEDED`

---

# FINAL LOCK

**Color Orb v3 = Color Halo Ring.**

The key visual idea is:

> Emotion presence determines arc length.  
> Perceptual color similarity determines adjacency and blend softness.  
> Real hex remains the color source of truth.  
> The result is one continuous, smooth color halo — not a segmented chart.

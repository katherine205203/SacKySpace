# Sắc Ký v2 Home — Golden UI Forensic Report

Audit date: 2026-08-29  
Repository: /Users/katherinebui/Documents/SacKySpace  
Audited commit: 503712c (merge: establish Sacky v2 web production baseline)

## Scope and evidence

This is a read-only extraction of the current repository. Only the four files in this directory were generated; application source, backend configuration, data logic, and dependencies were not changed.

Evidence used:

- Current Vite/React source and import graph.
- Git history and the main/feat/home-v2 refs.
- Checked-in visual references: [home-v2-option-a.png](/Users/katherinebui/Documents/SacKySpace/docs/ui-reference/home-v2-option-a.png) and [home-v2-checkin-detail-modal.png](/Users/katherinebui/Documents/SacKySpace/docs/ui-reference/home-v2-checkin-detail-modal.png).
- The supplied production URL was reachable, but it rendered the unauthenticated sign-in screen. No credentials were entered, so authenticated live DOM/style evidence was not collected.

## Executive finding

The latest mature implementation present in this checkout is the Sắc Ký v2 web baseline. Its runtime is:

src/main.tsx → src/app/App.tsx → AuthGate → AppShell → AppRoutes → / → HomePage.

The current Home is composed from src/features/home/ and reuses the shared Color Orb, intensity dots, and tags from src/features/checkin/components/CheckinComponents.tsx. It is newer than the original foundation and the Check-in-v2-only milestone because it adds the data-backed Home projection, Home v2 grid, recent journey, action preview, diary surface, personal surfaces, and check-in detail modal.

The task context names src/vnext/, src/vnext/home-golden/, src/vnext/checkin/, src/vnext/shell/, and src/vnext/navigation/, but none of those paths exist in this repository at the audited commit. There is therefore no separate vnext/home-golden entrypoint to mount or compare here.

## Application generations found

| Generation | Entrypoint and shell | Home | Check-in | Garden / MyLib | Evidence of age |
|---|---|---|---|---|---|
| Foundation | src/main.tsx → App → AppShell; placeholder header/sidebar | home-screen foundation placeholder | None | No | Git commit e52206d, “Establish SacKy web application foundation”; hash-routing-style #home navigation and placeholder copy. |
| Check-in v2 milestone | Same Vite entry; BrowserRouter → AuthGate → AppShell → AppRoutes; AppSidebar | Home placeholder with Check-in CTA/history | Full routed Check-in v2 screens and shared components | No | Git commit 0c82ae6, “feat: build Check-in v2 end to end”; real normalized Check-in routes/services but non-feature Home. |
| Home v2 production baseline | Same runtime shell; current AppSidebar, BrowserRouter, auth gate, route table | Data-backed HomePage with Home v2 grid and modal | Preserved Check-in v2 flow plus shared Orb primitives | No | Git commit 46e5685, “feat: establish Sacky v2 home web baseline”, merged as 503712c; adds the Home feature tree, aggregation/repository layer, reminder page, and Home CSS. |

No other application generation is present in the current source tree. docs/checkin-v2/ and docs/ui-reference/ are specification/reference material, not executable entrypoints. README.md still describes Home as a placeholder, but the current source tree and merge commit contain the data-backed Home v2 implementation; the README text is stale relative to the code.

## Source inventory

### Boot, routing, authentication, and shell

| Source | Responsibility | Home surfaces affected |
|---|---|---|
| [index.html](/Users/katherinebui/Documents/SacKySpace/index.html:1) | HTML root, title, viewport, theme-color, /src/main.tsx module mount | Document canvas and page title. |
| [src/main.tsx](/Users/katherinebui/Documents/SacKySpace/src/main.tsx:1) | React root; loads Be Vietnam Pro weights, Supabase client, global CSS, App | Font availability and all inherited global styles. |
| [src/app/App.tsx](/Users/katherinebui/Documents/SacKySpace/src/app/App.tsx:1) | BrowserRouter, AuthGate, AppShell, route tree mount | Determines whether Home is visible and supplies routing context. |
| [src/app/AppRoutes.tsx](/Users/katherinebui/Documents/SacKySpace/src/app/AppRoutes.tsx:20) | Route table and CheckinFlowProvider | Mounts HomePage at /; preserves Check-in/Reminder routes and placeholders. |
| [src/components/AuthGate.tsx](/Users/katherinebui/Documents/SacKySpace/src/components/AuthGate.tsx:1) | Session load and auth-state gate | Unauthenticated users see sign-in instead of Home. |
| [src/components/SignInScreen.tsx](/Users/katherinebui/Documents/SacKySpace/src/components/SignInScreen.tsx:23) | Sign-in fallback | Auth-gate appearance; not authenticated Home. |
| [src/layouts/AppShell.tsx](/Users/katherinebui/Documents/SacKySpace/src/layouts/AppShell.tsx:6) | Sidebar/main/content wrapper; adds Check-in content modifier | Sidebar, canvas width, scroll behavior, Home content gutters. |
| [src/components/AppSidebar.tsx](/Users/katherinebui/Documents/SacKySpace/src/components/AppSidebar.tsx:4) | Brand, primary navigation, Admin Studio footer, sign-out | Home/Check-in/Diary/Reminder/Future Letter/Gift for Tmr labels and active state. |
| [src/styles/globals.css](/Users/katherinebui/Documents/SacKySpace/src/styles/globals.css:1) | Root tokens, reset, shell, navigation, shared buttons/cards/modals/Orb and responsive rules | Inherited visual system and shared Check-in surfaces. |
| [vite.config.ts](/Users/katherinebui/Documents/SacKySpace/vite.config.ts:1) | Vite React plugin only | Confirms one SPA build entry; no runtime generation switch. |
| [package.json](/Users/katherinebui/Documents/SacKySpace/package.json:1) | dev, build, lint, test scripts and dependencies | Confirms Vite/React app and local font package. |

### Home composition and Home-specific styling

| Source | Responsibility | Home surfaces affected |
|---|---|---|
| [src/features/home/HomePage.tsx](/Users/katherinebui/Documents/SacKySpace/src/features/home/HomePage.tsx:18) | Home composition, data states, range/action derivation, modal ownership, edit/delete routing | Entire Home page and user action wiring. |
| [src/features/home/home.css](/Users/katherinebui/Documents/SacKySpace/src/features/home/home.css:1) | Home grid, hero, journey rail, actions, diary, personal surfaces, detail/reflection modals, Home breakpoints | All Home-specific geometry/effects/states. |
| [src/features/home/components/HomeHero.tsx](/Users/katherinebui/Documents/SacKySpace/src/features/home/components/HomeHero.tsx:27) | Greeting/streak, Orb, range selector, metrics, Check-in CTA | Main hero. |
| [src/features/home/components/HomeOrb.tsx](/Users/katherinebui/Documents/SacKySpace/src/features/home/components/HomeOrb.tsx:1) | Home adapter around shared ColorOrb; neutral #e6def6 empty fallback | Hero and check-in detail Orb. |
| [src/features/home/components/RecentJourney.tsx](/Users/katherinebui/Documents/SacKySpace/src/features/home/components/RecentJourney.tsx:11) | Three-day recent Check-in rail, scroll arrows, selectable cards | Recent Journey panel. |
| [src/features/home/components/ActionPreview.tsx](/Users/katherinebui/Documents/SacKySpace/src/features/home/components/ActionPreview.tsx:12) | Today/upcoming/overdue tabs and four-item action preview | Việc cần làm panel. |
| [src/features/home/components/DiaryToday.tsx](/Users/katherinebui/Documents/SacKySpace/src/features/home/components/DiaryToday.tsx:4) | Diary empty/draft/saved preview and internal art fallback | Nhật ký hôm nay panel. |
| [src/features/home/components/PersonalSurfaces.tsx](/Users/katherinebui/Documents/SacKySpace/src/features/home/components/PersonalSurfaces.tsx:3) | Future Letter and Gift links; CSS envelope and emoji gift art | Dành cho mình panel. |
| [src/features/home/components/CheckinDetailModal.tsx](/Users/katherinebui/Documents/SacKySpace/src/features/home/components/CheckinDetailModal.tsx:33) | Selected Check-in detail, Orb, metadata, tags, linked actions, reflection modal, edit/delete | Modal overlay and all modal states. |

### Shared visual and data dependencies

| Source | Responsibility | Home impact |
|---|---|---|
| [src/features/checkin/components/CheckinComponents.tsx](/Users/katherinebui/Documents/SacKySpace/src/features/checkin/components/CheckinComponents.tsx:34) | Shared ColorOrb; IntensityDots and TagList used by Home modal | Orb SVG layers, modal intensity dots/tags. |
| [src/features/checkin/utils/colorOrb.ts](/Users/katherinebui/Documents/SacKySpace/src/features/checkin/utils/colorOrb.ts:56) | Deterministic color-cloud calculation from color/intensity entries | Dynamic Home Orb color, position, radius, opacity, blur, blend mode. |
| [src/features/home/services/homeAggregation.ts](/Users/katherinebui/Documents/SacKySpace/src/features/home/services/homeAggregation.ts:5) | Timezone, Home ranges, streak, recent records, dynamic presentation colors, action buckets | Content and semantic colors; no layout. |
| [src/features/home/hooks/useHomeData.ts](/Users/katherinebui/Documents/SacKySpace/src/features/home/hooks/useHomeData.ts:13) | Home loading/error lifecycle | Loading and error panels/states. |
| [src/features/home/services/homeRepository.ts](/Users/katherinebui/Documents/SacKySpace/src/features/home/services/homeRepository.ts:88) | Supabase-backed Home projection | Data presence, display name, records, reminders; no styling. |
| [src/features/home/services/reminderRepository.ts](/Users/katherinebui/Documents/SacKySpace/src/features/home/services/reminderRepository.ts:1) | Linked action mutation methods used by Home modal | Behavior only; mutation controls are styled in home.css. |
| [src/features/home/types.ts](/Users/katherinebui/Documents/SacKySpace/src/features/home/types.ts:3) | Home range, reminder, snapshot, diary preview shapes | Determines conditional Home content. |
| [src/features/checkin/useCheckinFlow.ts](/Users/katherinebui/Documents/SacKySpace/src/features/checkin/useCheckinFlow.ts:1) | Home-to-Check-in edit handoff type/context | Preserves edit action; no visual rules. |
| [src/features/checkin/services/checkinRepository.ts](/Users/katherinebui/Documents/SacKySpace/src/features/checkin/services/checkinRepository.ts:215) | Home record list/delete/edit data boundary | Modal and recent journey data behavior; no styling. |

src/features/reminder/reminder.css is route-local and does not style the Home route, although ReminderPage shares Home aggregation/types/repository code.

## Raw visual system and layout forensics

The complete machine-readable extraction is in [HOME_GOLDEN_RAW_VALUES.json](/Users/katherinebui/Documents/SacKySpace/docs/ui-forensics/HOME_GOLDEN_RAW_VALUES.json). Key source-backed values:

- Canvas: #f8f6ff; surface: #ffffff; soft surface: #f3eef9; violet surface/pale: #ece4ff; rose: #fff0f7; mint: #ecfff8.
- Ink: #231b46; muted text: #625a75; soft text: #887f9d; border: #e5ddf5; divider: #ddd3ef.
- Brand: violet #743cff, dark violet #5326be, pink #ff4fa3; semantic coral/mango/cyan/mint/blue/green/danger values are declared in globals.css.
- Base family: Be Vietnam Pro with weights 400/500/600/700 imported in main.tsx; root line-height 1.5 and base size 1rem.
- Layout tokens: sidebar 13.25rem; global content max 91rem; Home max 92rem; Home grid 1.45fr + 0.95fr with a 25rem right-column minimum; outer gap 1rem.
- Main card: 1px translucent violet border, 1.35rem radius, translucent white fill, 0 10px 30px rgba(60,35,95,.055) plus an inset white highlight.
- Hero: minimum height 34.5rem, padding 1.35rem 1.65rem 1.2rem, two-column body, large Orb capped at 20rem, four range options, three source metrics, and a 9rem-minimum CTA.
- Recent Journey: horizontal overflow rail, 0.65rem card gap, min(13rem, 76%) card basis, 9rem minimum card height, scroll-snap proximity, conditional 1.8rem circular arrows.
- Actions: three pill tabs; rows use four columns (1.1rem minmax(0,1fr) auto 1rem), 0.68rem 0.1rem padding, and translucent dividers.
- Diary: two columns with a fixed 10.5rem art column and 12.2rem minimum height; empty state uses CSS gradients and ✦/✎ glyphs.
- Personal surfaces: two columns, 9.2rem minimum tile height, 0.9rem padding, internal CSS envelope for Future Letter and emoji gift for Gift for Tmr.
- Motion: CSS transitions are short ease transitions (.15s–.16s); no @keyframes or animation declarations are present. Orb rendering itself is static/deterministic.

## Shell and Home grammar

### Shell

Desktop uses a fixed-height 100dvh two-column grid: 13.25rem sidebar plus flexible main. The sidebar is a vertical flex column with 2.5rem gap, 1.5rem .9rem 1.25rem padding, a right border, and a nearly opaque near-white background. Primary nav rows are 3.15rem high with 1rem radius and a 0.3rem list gap. The active row is white text on a violet-to-purple linear gradient with a violet shadow. Admin Studio is separated into the bottom sidebar-footer and sign-out is beneath it.

At 58rem and below, the shell becomes a stacked layout: sidebar becomes a horizontal, scrollable nav row; the footer disappears; content becomes document-scrolling. At 42rem and 27rem, content padding, nav type, grids, and modal padding contract further.

### Home grid

The desktop Home grid has two columns and two rows:

hero | recent journey
diary | personal

The source grid areas are hero journey / diary personal, outer gap 1rem, and stretch alignment. At 58rem, all four areas stack in source order and the right column becomes a two-column row before becoming one column at 42rem.

### Hero

HomeHero renders greeting + optional first-name display, a leaf glyph, a fire streak block, the shared HomeOrb, range summary, tablist, optional custom date inputs, three metrics, and a link CTA to /checkin. The Orb is visually primary and is centered in the left hero-body column. On mobile the Orb is moved first and the summary is centered.

### Recent Journey

The recent panel renders a section header with “Hành trình gần đây”, a three-day copy line, history link, and a horizontally scrollable set of selectable cards. Each card carries date, time, emoji presentation, title, and a color swatch/hex string. Arrow controls only render when the rail can move; each click scrolls by max(78% of viewport, 220px) with smooth behavior.

### Action Space / Việc cần làm

The current source calls the surface Việc cần làm, not “Action Space”. It has three state tabs (Hôm nay, Upcoming, Quá hạn) and up to four linked rows. Rows include circular completion status, title/note, schedule, and a vertical-ellipsis affordance. The row links to /reminder; completion state is presentational in Home and mutations remain behind the repository.

### Diary

The diary surface is a two-column card. Copy is left-aligned with a section title, optional Draft/Đã lưu pill, either an empty prompt or saved preview, and a bottom-aligned link. The image path is optional in the data shape; the current Home always passes { status: 'empty' }, so the source-rendered branch is the neutral internal CSS artwork.

### Dành cho mình

The section contains two internal links: Thư cho mình and Quà cho ngày mai. The first is a CSS envelope with a seal; the second is an emoji gift. Both use a bottom-right circular arrow affordance. These are decorative internal implementations, not external assets.

## Component visual anatomy

| Pattern | Source | Anatomy / states / interaction |
|---|---|---|
| Brand lockup | globals.css .brand-lockup/.brand-mark; AppSidebar.tsx | Text + 2.15rem multi-radial CSS mark; no image asset. |
| Primary button | globals.css .button/.button--primary; Home CTA in HomeHero.tsx | Inline-flex, 2.5rem minimum height, .6rem 1rem padding, .75rem radius; violet/pink gradient, lift on hover. |
| Secondary/danger button | globals.css button variants; modal footer in CheckinDetailModal.tsx | Border/surface button; danger uses pale rose and #ff5c70; shared small variant uses 2rem minimum height. |
| Text link | globals.css .text-link/.text-button | Borderless transparent control, dark violet, .82rem, underline on hover. |
| Segmented control | home.css range/action tabs | Padded 999px container, .15rem internal gap, 999px options, active white text on violet or violet gradient. |
| Home card | home.css .home-v2__card | 1px translucent violet border, 1.35rem radius, translucent white surface, card shadow and inset highlight. |
| Journey card / carousel | RecentJourney.tsx, home.css lines 205–216 | Button card with date/time, centered emoji circle, title, color swatch; horizontal scroll-snap and hover lift. |
| Action row | ActionPreview.tsx, home.css lines 218–231 | Link grid with completion circle, copy, schedule, overflow glyph; completed state fills violet. |
| Metric strip | HomeHero.tsx, home.css lines 184–198 | Three equal columns separated by light rules, violet symbol, muted count/label, CTA beneath. |
| Empty state | DiaryToday.tsx, RecentJourney.tsx, ActionPreview.tsx, home.css lines 257–260 | Centered or copy-aligned glyph + muted message; compact variant minimum height 8rem. |
| Check-in detail modal | CheckinDetailModal.tsx, home.css lines 262–389 | Fixed blurred backdrop, scrollable detail body, two-column content/summary, footer actions, nested reflection modal. |
| Shared Orb | CheckinComponents.tsx, colorOrb.ts, globals.css lines 115–123 | SVG base, cloud gradients/blur, inner glow, sheen, halo, outline; small/medium/large CSS sizes. |
| Shared tag/intensity patterns | CheckinComponents.tsx, globals.css lines 138–144 | Five dot intensity display and rounded violet semantic tags; used in the Home detail modal. |

## Color Orb forensics

The Home Orb is not a mascot asset. HomeOrb delegates to the shared ColorOrb and supplies a neutral #e6def6 fallback when there are no Home entries. The Home aggregation intentionally includes only primary emotion colors weighted by stored intensity; Unknown records do not contribute color.

The renderer is an inline SVG with a viewBox of 0 0 200 200 and a clipped circle of radius 96. It builds one normalized color group per source color. For each group it emits six overlapping radial cloud circles:

1. Source aura: radius 70 + contribution*20, opacity .28 + contribution*.12, blur 8.5.
2. Source core: radius 46 + contribution*17, opacity .84 + contribution*.12, blur .8.
3. Light tint: source tinted 30% toward white, radius aura*0.72, opacity .24 + contribution*.14, blur 3.8.
4. Pale tint: source tinted 62% toward white, radius aura*0.62, opacity .12 + contribution*.1, blur 5.5.
5. Deep shade: source shaded 22%, radius aura*0.68, opacity .36 + contribution*.22, blur 2.4.
6. White highlight: radius aura*0.35, opacity .07 + contribution*.04, blur 3, screen blend mode.

Cloud centers are arranged around a radius-17 ring using the color index. The SVG adds a base radial gradient (#F7F0FF/.78 → #EEE6F8/.72 → #D9CFE9/.9), an inner white glow (.28 → .04 → 0), a white sheen with CSS blur 4px and screen blend mode, a violet halo at rgba(116,60,255,.1), and a white 2.5-unit outline. Base sizes are 5.5rem, 10rem, and 12rem; Home overrides the large Orb to min(100%, 20rem), and the detail summary identity Orb to 4.4rem.

The source comment calls the algorithm “canonical ColorOrb renderer”, while the Check-in v2 prompt calls for organic contiguous flat regions. The actual current code is radial-cloud/blur based, so the code—not the aspirational prompt—is the reliable record of current behavior.

## Inconsistency / CSS-debt findings (do not fix in this audit)

| Class | Finding | Evidence / interpretation |
|---|---|---|
| A — intentional | color-surface-violet and color-violet-pale both resolve to #ece4ff. | Likely role aliases for surface and focus/selected contexts. |
| A — intentional | Home uses home-v2__* selectors while shared Check-in uses generic primitives. | Feature-local layout needs different geometry while reusing buttons/Orb/tags. |
| B — drift | Card radii vary between 1.35rem, 1.375rem, 1.5rem, 1rem, .95rem, .9rem, .85rem, and tokenized radius-lg. | Visually related cards do not share one raw radius. |
| B — drift | Violet active styles mix tokenized violet, hard-coded #6d2cf2/#8c35d9, #5c43c6, and violet/pink gradients. | Equivalent selected/CTA roles have multiple implementations. |
| B — drift | Shadows are partly centralized (shadow-card, shadow-floating) and partly hard-coded per component. | Repeated soft purple shadow roles are not canonicalized. |
| B — drift | Spacing uses root space-* tokens but Home mostly uses literal rem values. | The token scale is not consistently consumed. |
| B — drift | Home detail modal uses a separate home-v2__modal-backdrop/detail-modal rather than shared modal-backdrop/modal-card. | Intentional richer detail layout, but duplicated modal surface treatment. |
| C — uncertain | Checked-in Home reference image shows five metric cells, a diary photo, and a gift illustration; current source renders three metrics, CSS diary art, and an emoji gift. | The screenshot may be stale or from a different implementation. Do not use it to infer missing source values. |
| C — uncertain | The checked-in Home reference image also shows a 3/7/14-day timeline beneath Recent Journey; current source has only the three-day horizontal card rail. | No current source component or selector supports the timeline. |
| C — uncertain | The reference Orb includes visible sparkle stars; current ColorOrb source has no star elements, only gradients, sheen, halo, and outline. | Live/reference visual detail is not source-supported. |
| C — uncertain | Production authenticated styling could not be inspected because the URL stopped at sign-in. | No claim of live/source equivalence. |

## Golden pattern candidates for future tokens/components

These are candidates only; no tokenization or refactor was performed. The machine-readable list is in [HOME_GOLDEN_TOKEN_CANDIDATES.json](/Users/katherinebui/Documents/SacKySpace/docs/ui-forensics/HOME_GOLDEN_TOKEN_CANDIDATES.json).

- Canonical semantic color roles: canvas, surface, soft surface, violet surface, text, muted text, soft text, border, divider, violet, dark violet, pink, danger.
- Canonical card recipes: standard Home card, compact journey card, detail summary card, floating modal.
- Canonical radii: pill (999px), card (1.35rem/1.375rem), compact control (.65rem–.8rem), circle.
- Canonical spacing: 1rem section gap, 1.25rem–1.35rem card padding, .65rem–.75rem row gap, .3rem–.5rem micro gap.
- Canonical button states: primary violet, gradient primary, secondary, danger, compact.
- Canonical shadow roles: card, floating, soft hover, Orb drop shadow.
- Canonical Home layout roles: shell sidebar, Home two-column grid, hero body split, journey rail, personal two-up grid.
- Canonical Orb renderer inputs: normalized six-digit source color, intensity weight, fallback neutral color, size variant.

## Negative findings

The current Home source does not use a mascot/Bé Mây asset, external image import, icon package, CSS @keyframes, or a separate Home-golden/vnext runtime. It does use CSS gradients, soft shadows, SVG blur, screen blending, and backdrop blur for overlays. The current source also contains no Garden or MyLib navigation/module.

No imported source image was found under src/; the only checked-in raster files are visual reference screenshots under docs/. The diary image branch exists in the type/component contract but is not populated by current HomePage; the rendered empty branch is internal CSS art.

## Verification and generated files

npm run build passed: TypeScript build plus Vite production bundle completed with 112 modules transformed. Vite emitted only a chunk-size advisory; no BOOT/BUNDLE blocker was reported.

The live production URL was not considered an authenticated Home verification because it rendered “Đăng nhập vào Sắc Ký” and no credentials were supplied.

Before documentation generation, git status --short was clean and git diff --name-only -- src was empty. After generation, the only new paths are the four documentation files below; no application source file was modified.

Generated:

- [HOME_GOLDEN_UI_FORENSIC_REPORT.md](/Users/katherinebui/Documents/SacKySpace/docs/ui-forensics/HOME_GOLDEN_UI_FORENSIC_REPORT.md)
- [HOME_GOLDEN_STYLE_SOURCE_MAP.md](/Users/katherinebui/Documents/SacKySpace/docs/ui-forensics/HOME_GOLDEN_STYLE_SOURCE_MAP.md)
- [HOME_GOLDEN_RAW_VALUES.json](/Users/katherinebui/Documents/SacKySpace/docs/ui-forensics/HOME_GOLDEN_RAW_VALUES.json)
- [HOME_GOLDEN_TOKEN_CANDIDATES.json](/Users/katherinebui/Documents/SacKySpace/docs/ui-forensics/HOME_GOLDEN_TOKEN_CANDIDATES.json)

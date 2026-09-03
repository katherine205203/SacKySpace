# Sắc Ký v2 Home — Golden UI Style Source Map

This map records the source of each visible Home surface and the shared styles inherited by it. Paths are absolute so the map can be used directly from the local workspace. This is an audit artifact; it intentionally does not prescribe changes.

## Runtime and ownership map

| Runtime layer | Source location | Owns / supplies |
|---|---|---|
| HTML document | /Users/katherinebui/Documents/SacKySpace/index.html:1 | Root element, title, viewport, theme color. |
| React boot | /Users/katherinebui/Documents/SacKySpace/src/main.tsx:1 | Root render, Be Vietnam Pro 400/500/600/700, Supabase client import, globals import. |
| Router/auth | /Users/katherinebui/Documents/SacKySpace/src/app/App.tsx:1 | BrowserRouter, AuthGate, AppShell, AppRoutes. |
| Route mount | /Users/katherinebui/Documents/SacKySpace/src/app/AppRoutes.tsx:20 | HomePage at /, Check-in routes, Reminder route, placeholders. |
| Auth boundary | /Users/katherinebui/Documents/SacKySpace/src/components/AuthGate.tsx:13 | Session loading/error/sign-in versus authenticated shell. |
| Shell | /Users/katherinebui/Documents/SacKySpace/src/layouts/AppShell.tsx:6 | Sidebar, app-main, app-content, Check-in modifier. |
| Navigation | /Users/katherinebui/Documents/SacKySpace/src/components/AppSidebar.tsx:4 | Brand, six primary nav entries, Admin Studio footer, sign-out. |
| Global style layer | /Users/katherinebui/Documents/SacKySpace/src/styles/globals.css:1 | Root tokens, reset, shell, buttons, shared cards, overlays, Orb base, breakpoints. |
| Home composition | /Users/katherinebui/Documents/SacKySpace/src/features/home/HomePage.tsx:18 | Data state, Home grid, child surfaces, selected record/modal. |
| Home visual layer | /Users/katherinebui/Documents/SacKySpace/src/features/home/home.css:1 | All home-v2__ selectors and Home media queries. |

## Home component-to-style map

| Component / source | Rendered class or primitive | Visual responsibility | Functional inputs |
|---|---|---|---|
| HomePage.tsx:18–61 | home-v2, home-v2__grid, home-v2__data-panel/state | Page width, loading/error states, four-area grid, modal ownership | HomeSnapshot, range, action summary, selected record. |
| HomeHero.tsx:27–56 | home-v2__card home-v2__hero | Greeting, streak, Orb column, range tabs, date controls, metrics, CTA | displayName, streak, Orb entries, range, counts. |
| HomeOrb.tsx:3–4 | color-orb color-orb--large/medium/small | Shared SVG Orb adapter and neutral empty fallback | Primary emotion color/intensity entries. |
| RecentJourney.tsx:41–50 | home-v2__journey, home-v2__journey-rail-wrap, home-v2__journey-rail | Header, history link, conditional rail arrows, scroll region | Recent records, three-day filter. |
| RecentJourney.tsx:53–61 | home-v2__journey-card-* | Date/time, emoji presentation, title, color swatch | CheckinRecord presentation. |
| ActionPreview.tsx:15–19 | home-v2__actions, home-v2__action-tabs, home-v2__action-list | Action filter tabs and empty state | Reminder list and tab. |
| ActionPreview.tsx:27–30 | home-v2__action-row, home-v2__action-status, home-v2__action-copy | Linked row, completion state, title/note/schedule | HomeReminder status and schedule. |
| DiaryToday.tsx:5–7 | home-v2__diary, home-v2__diary-copy, home-v2__diary-art/image | Empty/draft/saved diary copy and art column | HomeDiaryPreview; current Home passes empty. |
| PersonalSurfaces.tsx:3–7 | home-v2__personal, home-v2__personal-grid | Dành cho mình section and two-tile wrapper | Static internal links. |
| PersonalSurfaces.tsx:10–15 | home-v2__future-me, home-v2__gift, home-v2__envelope, home-v2__gift-art | CSS envelope and emoji gift decorations | Static internal links. |
| CheckinDetailModal.tsx:133–216 | home-v2__modal-backdrop, home-v2__detail-modal, home-v2__detail-layout | Selected-record overlay, detail content, summary rail, footer, reflection overlay | CheckinRecord, linked reminders, mutation callbacks. |

## CSS selector map — shell and global primitives

| Selector / range | File | Raw rules / role |
|---|---|---|
| :root lines 1–50 | globals.css | All color, shadow, type, spacing, radius, and layout variables; base font and canvas. |
| *, html, body, #root lines 51–58 | globals.css | Box sizing, minimum widths/heights, body margin reset, inherited controls, root width. |
| .app-shell line 59 | globals.css | Desktop two-column 100dvh shell, radial canvas wash. |
| .app-sidebar lines 60–62 | globals.css | 13.25rem sidebar, vertical flex, padding, border, brand mark. |
| .sidebar-nav lines 63–68 | globals.css | Nav list gap, 3.15rem rows, hover lift, active gradient/shadow, icon box. |
| .sidebar-footer lines 69–73 | globals.css | Admin placement, sign-out, footer gap. |
| .app-main/.app-content lines 74–77 | globals.css | Flexible main, content max/gutters/scrolling, Check-in overflow modifier. |
| .eyebrow/.text-link/.text-button lines 91, 113–114 | globals.css | Small uppercase violet labels and transparent text actions. |
| .button lines 202–209 | globals.css | Shared primary/secondary/small/danger button geometry and states. |
| .color-orb lines 115–123 | globals.css | Orb sizes, halo, base, sheen, outline, drop shadow. |
| .modal-backdrop/.modal-card lines 222–225 | globals.css | Shared Check-in modal treatment; Home detail modal has a local variant. |
| :focus-visible line 319 | globals.css | Global keyboard focus ring. |

## CSS selector map — Home local layer

| Selector / range | Responsibility | Raw geometry/effect |
|---|---|---|
| .home-v2 lines 1–5 | Page container | width 100%, max-width 92rem, centered. |
| .home-v2__data-state/panel lines 7–42 | Loading/error states | .75rem bottom margin; panel 15rem minimum, 2rem padding, 1.35rem radius, pale gradients, soft shadow. |
| .home-v2__grid lines 44–52 | Main layout | 1.45fr + min 25rem/.95fr, areas hero/journey and diary/personal, 1rem gap. |
| .home-v2__card lines 54–60 | Common Home card | 1px rgba(113,88,180,.14), 1.35rem radius, rgba white .8, soft card shadow + inset white. |
| .home-v2__hero lines 62–73 | Hero shell | 34.5rem minimum, 1.35rem 1.65rem 1.2rem padding, clipped layered background. |
| .home-v2__hero-header/.section-header lines 75–96 | Section headers | Flex start/space-between, 1rem gap, heading tracking. |
| .home-v2__eyebrow/.lede lines 98–112 | Home-local labels/copy | Violet uppercase .62rem 800; muted .76rem copy. |
| .home-v2__streak lines 114–124 | Streak badge | Two-column grid, .3rem column gap, flame/number/small label. |
| .home-v2__hero-body lines 126–148 | Orb + summary | 1.05fr/.95fr split, centered, responsive gap, Orb cap 20rem. |
| .home-v2__range-tabs/action-tabs lines 150–177 | Segmented controls | .25rem pad, .15rem gap, 999px radius, 1.8rem buttons, active violet/gradient. |
| .home-v2__custom-range lines 179–182 | Date inputs | Three-column grid, .35rem gap, .7rem top margin, .45rem input radius. |
| .home-v2__metrics/.cta lines 184–198 | Summary and CTA | Three equal metrics, top/bottom rules, 9rem CTA minimum, violet shadow. |
| .home-v2__right-column/.journey lines 200–216 | Right rail + Recent Journey | Two auto rows, 1rem gap; rail wrapper; horizontal scroll-snap cards; conditional circle arrows. |
| .home-v2__actions lines 218–231 | Action Space/Việc cần làm | 1.25rem padding, tabs, four-column action rows, .68rem vertical rhythm. |
| .home-v2__diary lines 233–242 | Diary surface | Copy + fixed 10.5rem art column, 12.2rem minimum, 0.85rem art radius, CSS artwork. |
| .home-v2__personal lines 244–255 | Future Letter/Gift surfaces | Two-up grid, 9.2rem tile minimum, envelope/gift art, bottom-right arrow. |
| .home-v2__empty lines 257–260 | Home empty states | 4.7rem default/8rem compact minimum and violet glyph. |
| .home-v2__modal-backdrop/detail-modal lines 262–306 | Home detail modal shell | Fixed 0.28 backdrop, blur 6px, 60rem max width, 90svh/48rem max height, floating shadow. |
| .home-v2__detail-layout through footer lines 307–389 | Home detail anatomy | 1.42fr/.78fr detail split, summary gradient, 10rem overview Orb, sectional rules, editor, footer, nested reflection modal. |
| Home media queries lines 391–434 | Responsive Home | 42rem detail collapse; 70rem grid/body shrink; 58rem full stack/right two-up; 42rem mobile; 27rem one-up personal. |

## Shared Check-in primitives used by Home

| Source | Export / selector | Home usage |
|---|---|---|
| CheckinComponents.tsx:34–75 | ColorOrb | Home hero, selected-record detail, selected-record summary. |
| CheckinComponents.tsx:234–239 | IntensityDots, TagList | Check-in detail intensity and secondary emotion/need/context tags. |
| colorOrb.ts:27–48 | normalizeHex, tint, shade | Sanitizes input and derives light/pale/deep tones. |
| colorOrb.ts:56–88 | buildOrbClouds | Six cloud layers per weighted normalized color. |
| globals.css:115–123 | color-orb family | Drop-shadow and size classes, halo/base/sheen/outline. |
| globals.css:138–144 | section-label, summary-dots, tag | Shared summary labels, five-dot display, rounded tags. |
| globals.css:202–209 | button family | Home modal/footer action states. |

## Data/runtime sources that influence appearance but not CSS

| Source | Appearance input |
|---|---|
| homeAggregation.ts:5–7 | Asia/Ho_Chi_Minh timezone and neutral Unknown presentation color #b8a5df. |
| homeAggregation.ts:37–41 | Home Orb receives only emotion primary color and intensity; Unknown contributes no color. |
| homeAggregation.ts:67–80 | Dynamic Journey title/emoji/color fallback values. |
| HomePage.tsx:20–29 | Data-derived name, range, selected record, interaction state. |
| HomePage.tsx:31–44 | Snapshot presence chooses loading/error/full layout. |
| HomePage.tsx:45–52 | Counts/range and CTA wiring. |
| HomeOrb.tsx:3–4 | Empty Home Orb fallback #e6def6. |
| DiaryToday.tsx:6 | Image branch is conditional, but current Home passes only status empty. |
| PersonalSurfaces.tsx:10–15 | Decorations are CSS/emoji, not data assets. |

## Entrypoint/version source map

| Evidence | Finding |
|---|---|
| src/main.tsx:9 and vite.config.ts:4 | One executable Vite client entry. |
| AppRoutes.tsx:24 | Current Home route is /. |
| AppRoutes.tsx:33–37 | Diary, Future Letter, Gift for Tmr, Admin Studio remain placeholders; Reminder is real. |
| AppSidebar.tsx:4–11 | Current navigation has Home, Check-in, Diary, Reminder, Future Letter, Gift for Tmr; no Garden/MyLib. |
| git show e52206d | Foundation generation: placeholder header/sidebar/Home. |
| git show 0c82ae6 | Check-in v2 generation: Router/auth/sidebar/full Check-in, placeholder Home. |
| git show 46e5685 and current tree | Home v2 generation: data-backed Home and shared visual primitives. |
| git ls-tree HEAD | No src/vnext, src/vnext/home-golden, src/vnext/checkin, src/vnext/shell, or src/vnext/navigation paths. |
| README.md:3-6 | Describes Home as a placeholder; this is stale relative to the current Home source and 503712c merge. |

## Asset audit map

| Search | Result |
|---|---|
| SacKy_BeMay_Master_Approved_WebP | No matches. |
| BeMay / mascot / Bé Mây | No application-source matches. |
| Source image imports | None under src/. |
| Relative imports with ../ | All resolved to repository-internal modules; no relative asset path escapes root. |
| Raster/vector files in src | None. |
| Checked-in visual assets | docs/ui-reference/*.png and docs/checkin-v2/ui/*.png only; they are documentation/reference inputs. |

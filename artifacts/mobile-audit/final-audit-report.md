# Sắc Ký v2 · Mobile polish audit

Date: 2026-09-13
Viewport matrix: 320, 360, 390, and 430 CSS px
Audit mode: Chromium via `agent-browser`, authenticated empty-data fixture

## Outcome

The mobile contract is now applied consistently across the app. The final automated capture covered 26 route/state variants at all four phone widths: 104 captures total.

| Check | Result |
| --- | ---: |
| Document-level horizontal overflow | 0 / 104 |
| Horizontally clipped controls | 0 / 104 |
| Focus writing mode at 390px | Pass |
| Populated Future Letter condition builder at 390px | Pass |
| Home desktop regression at 1280px | Pass |
| Diary editor desktop regression at 1280px | Pass |
| Unit tests | 74 / 74 passed |
| Production build | Passed |

The Future Letter empty-state landscape intentionally extends beyond its parent card and is clipped by that card; it does not contribute to document scroll width.

## Issues found and fixed

| Priority | Finding | Fix |
| --- | --- | --- |
| P1 | Check-in landing cards retained a desktop visual column at phone widths, forcing copy into extremely narrow vertical strips. | Stack the landing cards into one column and use a single-column card layout below 480px. |
| P1 | Diary editor’s later desktop breakpoint reintroduced a fixed 17rem summary rail after the earlier mobile rule, leaving the writing column only a few pixels wide. | Move the shared mobile stylesheet to the end of the app stylesheet graph and force Diary/Journey editor layouts to one column on mobile. |
| P1 | Check-in and authoring footers used negative horizontal margins, producing visible off-canvas bounds on narrow screens. | Remove mobile negative margins and keep footer content inside the page contract. |
| P1 | Rich-text toolbar controls rendered around 30px high and the toolbar could become unusable on touch screens. | Normalize toolbar buttons to 44px touch height, keep groups non-shrinking, and allow horizontal toolbar scrolling. |
| P2 | Home, Check-in, Diary, Gift, and Action tabs/links had inconsistent compact hit areas. | Normalize primary mobile tabs and key navigation links to the shared 44px target. |
| P2 | Future Letter condition-row actions were too small in the populated builder. | Normalize move/edit/delete and add-group controls to 44px hit areas. |

## Files changed for this audit

- `src/styles/globals.css` — shared mobile token contract.
- `src/styles/mobile.css` — final responsive contract, layout safeguards, safe areas, touch targets, modal/toolbar behavior.
- `src/app/App.tsx` and `src/layouts/AppShell.tsx` — ensure the mobile stylesheet loads after feature CSS.
- `scripts/mobile-audit.mjs` — repeatable 26-state × 4-width Chromium capture and DOM metrics.
- `artifacts/mobile-audit/audit-init.js` — browser-only synthetic auth/data fixture; not imported by application code.
- `package.json` — adds `npm run audit:mobile`.

## Coverage notes

The fixture uses a synthetic authenticated user and empty API responses, so it verifies empty states, responsive structure, route loading, controls, and overflow without reading or mutating user data. Populated rich-text and Future Letter condition-builder states were additionally exercised locally in-browser. Live-data detail drawers, uploaded-image previews, and server-side persistence still require a real authenticated session for end-to-end verification.

Existing lint warnings remain in the repository’s rich-text component and `.codex-build` scripts; this audit introduced no new lint errors.

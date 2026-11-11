## Accessibility review — InstaCaps editor

Scope: product UI · WCAG 2.2 AA · rendered at http://localhost:3000 in Chrome via Playwright with a 6-second test clip and 6 captions.
Viewports: 1440×900, 390×760 and 320×760 mobile. The editor is dark only.
Elements checked: 73 on the Captions tab, 76 on Style and 54 on Export, counting each piece of text and each icon. Every visible button, input, select and textarea was also checked for an accessible name.

Verdict: ✅ 0 Blockers · 0 Warnings · 1 Advisory · 8 resolved this run

### Pass/fail summary

| Check | WCAG | Result | Detail |
|---|---|---|---|
| Color contrast | 1.4.3 | ✅ PASS | Lowest: 6.99:1 (muted icons on the selected caption row) |
| Non-text contrast | 1.4.11 | ✅ PASS (fixed) | Waveform raised from 1.6:1 to 3.4:1; focus ring is near-white on black |
| Target size | 2.5.8 | ✅ PASS (fixed) | At 320px the player buttons had shrunk to 20px wide; now 28×32 or larger |
| Reflow | 1.4.10 | ✅ PASS | No page-level horizontal scroll at 390px or 320px; the timeline toolbar scrolls inside its own row |
| Labels / names | 1.1.1 / 4.1.2 / 2.5.3 | ✅ PASS (fixed) | 0 unnamed controls (before: icon buttons were named by glyphs such as "⤓" and "⌖") |
| Form labels | 1.3.1 / 3.3.2 | ✅ PASS (fixed) | Sliders linked to their labels; color pickers, selects, switches and In/Out fields named |
| State | 4.1.2 | ✅ PASS (fixed) | Segmented toggles expose `aria-pressed`; switches use `role="switch"`; the active tab has `aria-current` |
| Focus visible / order | 2.4.7 / 2.4.3 | ✅ PASS | Back → Export → player → tabs → panel; a ring or bright border on every stop |
| Errors | 4.1.3 | ✅ PASS (fixed) | The error banner has `role="alert"` and a dismiss button (it used to be dismissed by clicking the text) |

### Advisory

- The timeline zoom slider is 16px tall. It's covered by the 2.5.8 spacing exception (nothing else sits within 24px), but a taller hit area would be easier to use on touch screens.

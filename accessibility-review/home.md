## Accessibility review — InstaCaps home screen

Scope: product UI · WCAG 2.2 AA · rendered at http://localhost:3000 in Chrome via Playwright.
Viewports: 1280×860 (light and dark), 390×844 mobile, 320×640 mobile, 200% zoom.
14 elements checked (28 text and icon contrast checks across both themes).

Verdict: ✅ 0 Blockers · 0 Warnings · 2 Advisories · 3 resolved this run

### Elements checked

| # | Element | Light | Dark | Size / target | Result |
|---|---|---|---|---|---|
| 1 | Wordmark "InstaCaps" | 19.80:1 | 16.91:1 | 17px / 600 | ✅ |
| 2 | Header "Sign in" button | 19.80:1 | 16.91:1 | 36px tall desktop, 44px on touch | ✅ |
| 3 | Headline h1 | 19.80:1 | 16.91:1 | 80px / 600 | ✅ |
| 4 | Lede paragraph | 5.74:1 | 7.66:1 | 17px / 400 | ✅ |
| 5 | "Upload video" button (label + native file input) | 19.80:1 | 16.91:1 | 192×56, 288×56 at 320px | ✅ |
| 6 | Upload arrow on gradient disc | decorative (`aria-hidden`), label carries the meaning | | 40×40 | ✅ decorative |
| 7 | Meta line (limits) | 5.74:1 | 7.66:1 | 13px / 400 | ✅ |
| 8 | "Recent" heading | 5.74:1 | 7.66:1 | 13px / 500 | ✅ |
| 9 | Recent row name (button) | 19.80:1 | 16.91:1 | 244×98 at 320px | ✅ |
| 10 | Recent row meta | 5.74:1 | 7.66:1 | 13px / 400 | ✅ |
| 11 | Recent row delete (icon button, `aria-label="Delete <name>"`) | 5.74:1 | 7.66:1 | 44×44 | ✅ |
| 12 | Sign-in prompt title + body | 19.80 / 5.74:1 | 15.74 / 7.13:1 | 17px, 15px | ✅ |
| 13 | "Continue with Google" button | 19.80:1 | 15.74:1 | 320×44 | ✅ |
| 14 | Prompt close (icon button, `aria-label="Close sign-in"`) | 5.74:1 | 7.13:1 | 40×40 | ✅ |

### Pass/fail summary

| Check | WCAG | Result | Detail |
|---|---|---|---|
| Color contrast | 1.4.3 | ✅ PASS | Lowest: 5.74:1 (muted text, light) |
| Non-text contrast | 1.4.11 | ✅ PASS | Focus ring = text color (≥16.9:1). Outline buttons rely on their text label, not the 1.5:1 border. |
| Target size | 2.5.8 | ✅ PASS | Smallest: 36px Sign in (desktop pointer); 44px on touch |
| Resize / reflow | 1.4.4 / 1.4.10 | ✅ PASS | No horizontal scroll at 200% zoom or 320px |
| Text spacing | 1.4.12 | ✅ PASS | 1.5 line-height, 0.12em letter-spacing at 320px: nothing clipped |
| Use of color | 1.4.1 | ✅ PASS | Errors are text with `role="alert"` |
| Labels / names | 1.1.1 / 4.1.2 / 2.5.3 | ✅ PASS | Icon buttons named; upload input named by its label "Upload video" |
| Focus visible / order | 2.4.7 / 2.4.3 | ✅ PASS | 2px solid ring on every control; prompt follows the header in tab order |
| Focus not obscured | 2.4.11 | ✅ PASS (fixed) | Header Sign in button is hidden while the prompt covers it |
| Keyboard | 2.1.1 / 2.1.2 | ✅ PASS | Escape closes the prompt; Sign in moves focus in and back out |
| Reduced motion | 2.3.3 (AAA, advisory) | ✅ | Entrance animations off; prompt fades without movement |

### Resolved this run

- **Sign-in prompt order (2.4.3):** it was last in the tab order; moved straight after the header.
- **Covered focus (2.4.11):** the header Sign in button sat under the open prompt; it's now hidden while the prompt is open.
- **Focus return (2.4.3):** closing a prompt opened from Sign in now returns focus to that button.

### Advisories

- The prompt opens on its own without a screen-reader announcement. That's deliberate for a non-modal prompt, matching Google One Tap. Revisit it if sign-in becomes required before uploading.
- Deleting a project uses the browser's `confirm()` dialog, whose buttons say OK / Cancel. It's accessible, but the button doesn't name the action (3.3.4 is met).

## Accessibility review — landing page, log in, sign up

Scope: product UI · WCAG 2.2 AA · rendered at http://localhost:3000 (`/`, `/login`, `/signup`) in Chrome via Playwright.
Viewports: 1440×900 in light and dark, plus 390px and 320px mobile with reduced motion on.
Accounts were in local mode (no Firebase keys), so the signed-in account menu wasn't rendered.
This supersedes the header findings in `home.md`.

Verdict: ✅ 0 Blockers · 0 Warnings · 2 Advisories · 2 resolved this run

### Pass/fail summary

| Check | WCAG | Result | Detail |
|---|---|---|---|
| Color contrast | 1.4.3 | ✅ PASS | Lowest real text: 5.27:1 in light (setup note), 6.74:1 in dark. Lowest across all three pages: 102 / 24 / 25 text elements checked |
| Labels / names | 1.3.1 / 4.1.2 | ✅ PASS | 0 unnamed controls; every field has a visible `<label for>` |
| Input purpose | 1.3.5 | ✅ PASS | `autocomplete` is name / email / current-password / new-password |
| Focus order | 2.4.3 | ✅ PASS (fixed) | Home → Google → Email → Password → Forgot password → Log in → Create an account |
| Focus visible | 2.4.7 | ✅ PASS | 2px ring on buttons and links; fields get a 2px ink border |
| Errors | 3.3.1 / 3.3.3 | ✅ PASS (fixed) | An empty submit now says "Enter your email address." (`role="alert"`, linked by `aria-describedby`) |
| Reflow | 1.4.10 | ✅ PASS | No horizontal scroll at 390px or 320px |
| Target size | 2.5.8 | ✅ PASS | Nav links 36px (44px on touch); Forgot password ≥24px |
| Motion | 2.2.2 / 2.3.3 | ✅ PASS | The hero timeline and the caption scene stop under reduced motion; the timeline pauses off-screen |

### Advisories

- The hero timeline loops continuously and has no pause control. It's decorative (`aria-hidden`), stops for reduced motion and pauses off-screen. Add a pause button if it ever carries information.
- Word chips fading in and out at the timeline's edges dip below 4.5:1 while masked. They're decorative and repeat the caption line above them, which passes.

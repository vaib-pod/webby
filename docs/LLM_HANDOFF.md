# WEBBY — FULL PROJECT HANDOFF CONTEXT FOR ANOTHER AI CODING ASSISTANT

> **READ THIS FIRST IF YOU ARE THE NEXT DEVELOPER OR LLM.** This file is meant to be uploaded to ChatGPT, Claude, Cursor, Gemini or another software engineering assistant alongside the `README.md` and source repository. **DO NOT** design a new product or rewrite all modules from scratch. This is an implemented JavaScript MVP. Continue it safely.

## 0. How to use this context

You are joining the development of **WEBBY — AI-Powered Adaptive Accessibility for the Web**, from the user's ten-slide uploaded proposal. The project already contains a working codebase intended to be loaded as a local Chrome extension, an optional AI backend, a dashboard, deterministic preference learning, a demo site, and 15 automated tests. The current goal is **improve/test/extend this code**, not regenerate the pitch.

**Required first steps for any coding assistant:**

1. Read this complete document and `README.md`.
2. Inspect `extension/manifest.json`, `extension/content.js`, `extension/background.js`, `extension/shared/contracts.js`, `extension/shared/storage.js`, `extension/shared/twin.js`, `backend/server.js`, and `backend/ai.js`.
3. Run `npm run verify` from the repository root. Do not assume the test result remains unchanged after edits.
4. Use the actual browser with `chrome://extensions` → Developer mode → Load unpacked → `extension/`; run `npm run demo`; test `http://127.0.0.1:4173`.
5. Tell the human which part you will change and the acceptance test. Preserve runtime compatibility and security constraints.

## 1. Product identity and intent

**Name:** WEBBY. **Tagline:** “Don't adapt yourself to the website. Let the website adapt to you.”

The user wants an actual **Chrome accessibility prototype**, not a webpage mockup. The proposed solution is an extension that:

- Understands a webpage using measurable rules plus optional AI structural/context analysis.
- Understands the user via persistent, granular preferences.
- Decides and applies safe, reversible adaptations.
- Learns from explicit feedback and site-specific preference signals via the **Accessibility Twin**.
- Keeps user consent and privacy central.

Origin from presentation:

- **Slide 2:** different sites create inconsistent accessibility barriers and repetitive manual adjustments.
- **Slide 3:** individual needs vary, context matters, desired layer is user-controlled, persistent and context-aware.
- **Slide 4:** five-step core flow understand page → understand context → understand user → decide → learn.
- **Slide 5:** AI web understanding, granular personal profile, context-aware adaptation, Learn From Me, Accessibility Twin.
- **Slide 6:** desired outcomes and proposed metrics (manual adjustments, comfort time, contrast/spacing before-after, user feedback).
- **Slide 7:** original proposed stack Chrome MV3/TypeScript, DOM/CSS/MutationObserver, Node/Express/LLM, Next.js dashboard, local storage/Supabase.
- **Slide 8:** Website → Extension → Privacy Filter → Rules+AI → Adaptation Decision → Validation → Adapted Webpage, with dashboard, profile/Twin and feedback loops.
- **Slide 9:** local-first consent, exclude form content, minimized AI payloads, validated allowed transformations.
- **Slide 10:** limitations: AI latency/cost, website compatibility, assistive technology compatibility, privacy/security.

**Source file:** `docs/ORIGINAL_PROPOSAL.pdf` is a copy of the user-provided ten-slide presentation. The product goals above are source-derived, but technical implementation decisions described below are choices made for the present MVP.

## 2. Current implementation (what exists)

This is an **unbundled Manifest V3 Chrome extension** with **vanilla JavaScript ES modules**, a **Node.js built-in HTTP server**, and **local storage**. No `npm install` necessary.

| Capability | Current status | Evidence / file |
|---|---|---|
| MV3 extension registration | Implemented source; load as unpacked | `extension/manifest.json` |
| Popup quick controls, feedback, optional AI button | Implemented | `extension/popup.html`, `.css`, `.js` |
| Full dashboard with tabs, live preview, profile, Twin, privacy | Implemented | `extension/dashboard.html`, `.css`, `.js`, `ui.css` |
| Text/font scaling and line spacing | Implemented | `extension/content.js` |
| Solid-background contrast correction | Best-effort implemented | `extension/content.js` |
| Reversible site/global dark mode | Implemented best-effort with media counter-filtering | `extension/content.css`, `content.js` |
| Reduced motion and focus assist | Implemented | `extension/content.css` |
| Original inline style restoration | Implemented | `extension/content.js` `resetStyles()` |
| DOM mutation observer | Implemented basic | `extension/content.js` |
| Current-page category, issues, summarized elements | Implemented structural sampling | `extension/content.js` `samplePage()` |
| User profile and site overrides | Implemented via chrome.storage.local | `extension/shared/storage.js` |
| Explicit feedback and deterministic Twin | Implemented | `extension/shared/twin.js` |
| Local AI backend, Chat Completions provider, 9s timeout | Implemented; real key not tested | `backend/ai.js`, `server.js` |
| AI request/response field and action validation | Implemented | `extension/shared/contracts.js` |
| Offline AI fallback | Implemented and labeled fallback | `contracts.js`, background/server |
| Sensitive-page guard | Heuristic implemented | `extension/content.js` `isSensitive()` |
| Untrusted AI code execution | Intentionally NOT supported | strict finite action types |
| Demo page | Implemented | `demo/index.html`, `styles.css` |
| Automated Node tests | 15 passing, including Dark mode UI wiring and H1–H6 regression coverage | `tests/*.test.js` |
| Real Chrome browser end-to-end acceptance | Core features manually checked by the project owner; re-test new Dark mode on target sites | `docs/TESTING.md` |
| Cloud authentication / Supabase / Next.js | **NOT IMPLEMENTED** (future scope) | intentional MVP constraint |
| ML-based inferred disability personalization | **NOT IMPLEMENTED** | deliberately explicit-feedback only |

The current project runs 15 automated tests successfully, including backward-compatible Dark mode profile validation, H1–H6 heading-tag regression coverage, and a UI wiring test that ensures the Dark mode controls are present in both the green popup and dashboard. Re-run `npm run verify` after every change. The demo server responded HTTP 200. Headless Chromium in the producer environment blocked localhost sites under an organizational browser policy, so this is not evidence of browser-level end-to-end success. Re-run the manual Chrome checklist on a real developer machine before claiming the product is validated.

## 3. Repo structure and ownership map

```text
README.md                   Main setup and feature documentation
package.json                npm scripts (no dependency install)
extension/manifest.json     Chrome permission declaration + MV3 service worker
extension/background.js     Message router, consent enforcement, backend fetch
extension/content.js        DOM scan + context classifier + mutation/reversal
extension/content.css       Scoped focus + reduced-motion CSS
extension/popup.*           Current tab preferences, Twin feedback, AI control
extension/dashboard.*       Preferences, dashboard/twin/consent/analysis status
extension/ui.css            Shared popup/dashboard CSS
extension/shared/contracts.js  VALIDATION SOURCE OF TRUTH
extension/shared/storage.js    local storage read/write + effective profile
extension/shared/twin.js       feedback -> patch; summaries
backend/server.js           Loopback API GET /api/health and POST /api/analyze
backend/ai.js               AI system prompt + provider call/fallback
demo/index.html             Deliberately poorly styled webpage
demo/styles.css             Demo styling and animation
tools/serve-demo.js         Local demo HTTP server
tools/check.js              Static JS syntax and manifest validation
tests/contracts.test.js     Schema, privacy, action, fallback tests
tests/twin.test.js          Feedback-learning behavior tests
tests/server.test.js        HTTP API integration test
docs/                       Architecture, API, security, testing, original pitch
```

## 4. Hard constraints — preserve them

### Privacy

- User preferences are sensitive: **do not sync them to a cloud service by default**.
- AI is opt-in and must be triggered by an explicit **Analyze** click.
- The model input intentionally includes **no page text or form fields**; its context consists of structural roles, tags, issue types, coarse category, and prefersDarkTheme flag.
- Block AI processing if a password/payment input or sensitive route is detected. Improve guards conservatively, do not remove them casually.
- Never send page URLs, hostnames or titles to the AI provider in v1.
- Never put `OPENAI_API_KEY` in frontend or extension code; it is a backend environment variable.

### Security

- Model outputs are **declarative JSON actions** from an allowlist, never arbitrary HTML, CSS, JS, XPath, selectors or `eval`.
- Clamp numeric parameters; verify target IDs exist and roles match.
- Re-validate responses in the extension even if the backend validated them.
- Preserve `chrome-extension://` origin CORS policy and loopback-only backend for local development.
- Do not claim CORS is authentication or that the backend is production hardened.

### Accessibility safety

- Do not rewrite input fields, passwords, editable content or semantics.
- Preserve original inline styles so WEBBY can be disabled without leaving changes.
- Do not hide essential controls to reduce clutter.
- Do not guarantee arbitrary websites become WCAG compliant. Validation with actual users / screen readers is necessary.

### Technical

- Maintain a loadable Manifest V3 extension; any new bundler must ship an actual distributable extension directory.
- Preserve `extension/shared/contracts.js` as canonical schema and keep tests in sync.
- Keep offline rule-based/profile/Twin functionality fully usable with **no backend**.

## 5. Shared profile contract

```js
{
  version: 1,
  enabled: true,
  fontScale: 1.1,          // 1.0 to 1.5
  lineHeight: 1.6,         // 1.2 to 2.0
  contrastMode: 'normal',  // 'normal' or 'high'
  darkMode: false,           // best-effort reversible dark appearance
  reduceMotion: false,
  focusAssist: true
}
```

Each site override is `{hostname:'example.com',updatedAt:'2026-...ISO',patch:{fontScale:1.3,...}}`. All such data is validated on read and write by the storage layer.

**Explicit feedback kinds:** `text-too-small`, `need-more-spacing`, `increase-contrast`, `reduce-motion`, `reset-this-site`. A text feedback click adds 0.10 scale (max 1.5), spacing +0.15 (max 2.0), contrast sets high, motion sets true, reset clears that site's patch. This is the Twin v1 definition; do not claim it trains a neural network.

## 6. AI schemas and flow

Request:

```json
{
  "version": 1,
  "profile": {"version":1,"enabled":true,"fontScale":1.1,"lineHeight":1.6,"contrastMode":"normal","darkMode":false,"reduceMotion":false,"focusAssist":true},
  "page": {
    "category":"article",
    "prefersDarkTheme":false,
    "elements":[{"id":"e1","role":"main","tag":"MAIN"}],
    "issues":[{"type":"small-text","severity":"medium","elementId":"e1"}]
  }
}
```

Response:

```json
{
  "version": 1,
  "source": "ai",
  "actions": [{"type":"SET_TEXT_SCALE","factor":1.2}],
  "reasons": ["Text appears small for comfortable reading."]
}
```

`source` is `ai` only if a provider responds successfully with valid actions; otherwise it is `fallback`. Action types: `SET_TEXT_SCALE`, `SET_LINE_HEIGHT`, `BOOST_CONTRAST`, `REDUCE_MOTION`, `ENHANCE_FOCUS`, `HIGHLIGHT_MAIN`. Numeric bounds and target rules live in `contracts.js` (see `docs/API_CONTRACT.md`). The content script currently uses global scale/spacing/contrast even when optional target IDs appear, while `HIGHLIGHT_MAIN` uses the element ID directly. This is a known product improvement opportunity.

## 7. Initial setup / commands

```bash
# From repository root:
npm run verify                # JS syntax, manifest, unit/integration tests
npm run demo                  # http://127.0.0.1:4173
npm run server                # http://127.0.0.1:3001
```

Install extension: Chrome → `chrome://extensions` → Developer mode → Load unpacked → select **`extension/`**. Visit demo, refresh tab, open toolbar popup.

**Real AI:** `OPENAI_API_KEY` + optionally `OPENAI_MODEL` must be exported in the server terminal before `npm run server`. `.env.example` is reference only and not auto-loaded. No key = honest fallback.

**Windows PowerShell:** `$env:OPENAI_API_KEY="..."; npm run server`.

## 8. Important design decisions already made

1. **Plain JS**, not TypeScript: no package download/bundling and user can open extension immediately. Add TypeScript only with a reliable build/distribution plan.
2. **No React/Next.js**, but real multi-tab dashboard built as extension options UI. Migrating UI is optional after browser QA.
3. **Node `http`**, not Express: same endpoint contract, zero deps.
4. **No Supabase**, profile local only. Cross-device sync remains a future consent-and-authentication project.
5. **Structure-only AI summaries** are privacy preserving but limit deep article/image understanding. Do not claim semantic image interpretation is fully done.
6. **No passive learning**: Twin learns only on explicit user feedback; this is transparent and demonstrable.
7. **AI suggestions are per-tab temporary**, whereas profile + site overrides persist. Product UI should communicate this distinction.

## 9. Next developer backlog (prioritized and actionable)

### P0 — Manual functional browser QA (do before announcing completion)

- Load unpacked extension and test the supplied demo page in desktop Chrome.
- Check `chrome://extensions` for errors, especially background service-worker console errors.
- Verify popup shows hostname and current site profile, and that Save affects the tab promptly.
- Verify selecting 125%, high contrast, Dark mode, motion, and keyboard focus visibly changes demo.
- Verify the green popup includes a per-site Dark mode switch and the dashboard Preferences includes a global Dark mode switch.
- Verify disabling/restoring returns original inline styles.
- Verify Dark mode changes the page to a dark appearance and switching it off restores the original colors; inspect images, video, SVG, embedded content, and fixed/sticky elements.
- Verify Twin feedback updates local override and persists after refresh.
- Verify dashboard tabs, preview, reset, consent state and server health status.
- Verify AI fallback when server is missing and when key missing; later test actual provider API.
- Document and fix any issues; add at least one regression test per bug.

### P1 — Improve specificity and robustness

- Implement **true per-element target handling** for `SET_TEXT_SCALE`, `SET_LINE_HEIGHT`, `BOOST_CONTRAST` rather than applying globally when `targetId` is provided. Reuse opaque node map, bound numeric settings and style restoration. Update `docs/API_CONTRACT.md` accordingly.
- Avoid reprocessing all 1,400 text elements for minor DOM additions; incrementally adapt appended nodes if safe.
- Improve contrast detection for translucent layered backgrounds without breaking images/buttons. Test on dark and light demo pages.
- Improve transparent handling of host permission and unsupported browser pages.
- Explicitly show temporary AI action state and Reset AI Suggestions in popup.

### P2 — Engineering/testing maturity

- Create Playwright or Puppeteer extension E2E tests using a local Chromium instance. Install dependencies as dev-only and document versions, ensuring an offline package still loads.
- Add axe-core / accessibility audit to popup and dashboard plus manual keyboard and screen-reader checks.
- Add structured `README` screenshots captured from a real Chrome extension.
- Improve error reporting for storage access and if the local API provider is configured but rate limited.
- Add performance measurements and broader dynamic-app compatibility tests.

### P3 — Expansion after core demo succeeds

- Move to TypeScript with a build tool and stable distributable `dist/extension` if team desires.
- Consider React dashboard or Next.js with an extension bridge only when needed.
- Add explicitly opted-in Supabase sync and authentication, with security review and per-user data isolation.
- Add per-context learned patterns while keeping behavior explainable and consented.
- Consider enhanced semantic AI with **new** explicit permission for optional selected non-sensitive text and a strict sensitive-content filter, not by silently extending the current payload.
- Explore assistive-technology support and future cognitive-load modes, language localization, mobile compatibility per original proposal slide 10.

## 10. How to make changes safely

For adding a new adaptation action, edit in this order:

1. `extension/shared/contracts.js`: define allowlisted action and strict validation.
2. `backend/ai.js`: update system prompt to explain action and conservative use.
3. `extension/content.js`: implement reversible, bounded application.
4. `extension/background.js`: usually unchanged because it validates using shared contracts, but verify end-to-end.
5. `tests/contracts.test.js`: test valid + malicious cases.
6. `docs/API_CONTRACT.md`, `docs/SECURITY.md` and `README.md`: document behavior.
7. `npm run verify` and Chrome demo manual test.

For modifying profile settings, change `contracts.js` defaults/validator → `storage.js` merging → `popup.js`/dashboard.js controls → content.js application → tests → docs. For Twin feedback update `twin.js`, UI buttons, storage, tests.

## 11. How to explain product status to the team

Accurate summary:

> WEBBY v1 has a complete runnable source implementation: MV3 extension, popup, local preference dashboard, reversible reading adjustments including best-effort Dark mode, explicit-feedback Accessibility Twin, optional minimized-JSON AI recommendations, offline fallback, demo site and passing Node tests. **Manual Chrome browser QA and live provider-key testing are still outstanding.** The source-deck's Next.js, Supabase, rich image understanding, advanced ML learning, and broad assistive-technology support are future scope.

Do **not** say “fully WCAG compliant,” “works on every website,” “AI automatically learns your disability,” “secure for production deployment,” or “comprehensively browser-tested.”

## 12. Ready-made prompt to paste into the next LLM

> You are taking over an **existing repository**, not creating a new app. The project is WEBBY, a Chrome MV3 accessibility extension. Read `README.md`, `docs/LLM_HANDOFF.md`, `docs/ARCHITECTURE.md`, `docs/API_CONTRACT.md`, `docs/SECURITY.md`, and relevant source files in full. Preserve local-first privacy, explicit AI consent, safe reversible DOM changes and whitelist validation. Begin by running `npm run verify` and testing the unpacked extension on the supplied demo in Chrome, documenting any real issues. Then implement the next highest priority outstanding item from the P0/P1 backlog with regression tests. Do not invent features as complete if they are not implemented. Return changed files and exact reproduction steps.

---

**This context is intentionally self-contained.** The recipient can understand the original product, actual implemented architecture, interfaces, how to run it, safety constraints, test evidence, known gaps and roadmap without the earlier chat history.

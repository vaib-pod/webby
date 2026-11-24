# WEBBY — Working Prototype (v1.0)

**Comfortable reading with optional summaries and speech**  
*“Don't adapt yourself to the website. Let the website adapt to you.”*

WEBBY is a **local-first Chrome/Chromium Manifest V3 extension** that applies reversible accessibility adaptations to ordinary webpages based on user preferences. An optional local Node.js backend provides summaries and read aloud after you review the page text and grant permission. Preferences can be saved per website.

**This is executable source code, not a slide mockup.** The extension runs directly from the `extension/` folder, with no bundling, package downloads, cloud account or database. The dashboard is an extension options page. The backend uses Node's built-in HTTP server. This intentionally differs from the original proposal's aspirational Next.js + Express + Supabase stack; see [Implementation choices](#implementation-choices).

## 1. What's included

| Module | Implemented feature | Files |
|---|---|---|
| Chrome extension | MV3 manifest, content script, service worker, popup | `extension/manifest.json`, `content.js`, `background.js`, `popup.*` |
| Rule-based adaptations | Text scale, line height, high-contrast readable text, reversible dark mode, reduced motion, keyboard focus | `extension/content.js`, `content.css` |
| Quick Accessibility Presets | Reading Mode, Low Vision and Calm Mode; immediate site-specific saving; derived Custom state | `extension/shared/presets.js`, `popup.*` |
| Focus Reading Mode | Local sanitized article view, safe links, keyboard navigation, Exit/Escape and restored focus/scroll | `extension/content.js` |
| Reading Ruler | Noninteractive 56px highlight follows pointer/focus; independent per-site persistence | `extension/content.js`, `content.css`, `shared/storage.js` |
| Automatic reapplication | Detect added DOM nodes and reapply after a short debounce | `extension/content.js` |
| Reversible changes | Preserve/reinstate original inline styles when off or settings change | `extension/content.js` |
| Personal Accessibility Profile | Persistent local preferences and per-site overrides | `extension/shared/storage.js`, `shared/contracts.js` |
| Settings dashboard | Overview, preferences, site overrides, privacy controls | `extension/dashboard.*`, `ui.css` |
| Colour Vision Support | Manual palette comparison, local plate activity, reversible website colour cues and validated preferences | `extension/colour-vision.*`, `colour-content.js`, `shared/colour.js`, `shared/twin.js` |
| Privacy guard | Reading preview, shared summary/speech consent, and sensitive page guards | `extension/content.js`, `shared/contracts.js` |
| Demo | Intentionally low-contrast, small-text, animated test page | `demo/` |
| Tests | Profile validation, reading privacy, HTTP endpoints and CORS | `tests/` |
| Handoff | Architecture, contracts, testing steps, future work, detailed LLM context | `docs/` |

**Validation:** `npm run verify` checks JavaScript syntax, Manifest V3 and automated tests. `npm run browser:check` exercises real Chrome with mocked extension APIs and providers. `npm run extension:check` installs WEBBY into a disposable Chrome profile and verifies real colour-settings application, persistence and restoration. Live Groq summaries and Gnani speech have also been verified with fixed sample text.

## 2. Fastest start — Chrome extension only

1. Unzip the project to a permanent folder (e.g. `Documents/WEBBY_Complete_Prototype`).
2. Open **Google Chrome** or another Chromium-based browser and navigate to `chrome://extensions`.
3. Enable **Developer mode** (upper-right).
4. Click **Load unpacked**.
5. **Select the `extension` folder** inside this project, **not** the root ZIP/project folder.
6. Pin WEBBY from the browser's extensions toolbar.
7. Open an ordinary `http://` or `https://` webpage. **Refresh it once** if the extension was just installed.
8. Click WEBBY in the toolbar. Change text size/spacing, enable **Dark mode**, adjust contrast and click **Save for this website**. Dark mode is a best-effort whole-page inversion; media elements are counter-filtered, but complex sites may need manual checking.
9. Open **Open dashboard** in the popup (or select **Details → Extension options**).

The rule-based accessibility features, dashboard, preferences **work without the backend**. Chrome doesn't allow content scripts on internal pages like `chrome://extensions` or the Chrome Web Store; that is expected.

**Colour Vision Support:** open Accessibility controls in the popup, or the Colour Vision Support card in dashboard Preferences. Compare and apply a palette manually, or try the local ten-plate activity using the confirmed answer key. Results are non-diagnostic and answers are not saved. See [the feature guide](docs/COLOUR_VISION.md) for image/key configuration, Chrome test steps, file inventory and limitations.

### Presets and local reading tools

These three features work without the backend or API keys. Reload WEBBY in `chrome://extensions` and refresh the webpage after updating the extension.

- **Quick Accessibility Presets:** click Reading Mode (120% text, 1.8 line spacing), Low Vision (145%, 1.9, high contrast and reduced motion), or Calm Mode (115%, 1.75, reduced motion, warm cream surfaces and brown text). Each preset enables WEBBY, turns dark mode off, keeps focus highlighting on, immediately applies, and saves for that hostname. The selected card is derived from the current controls. Manual edits show **Custom** when they no longer match a preset; click **Save for this site** to persist those manual edits. **Reset** restores the global profile.
- **Reading Ruler:** toggle it in Reading Tools. The translucent highlighter-yellow band follows the pointer vertically and follows keyboard focus. It never captures clicks or text selection. Its setting persists per hostname in `webbyReadingTools:<hostname>`, separately from profile overrides. Profile Reset leaves this separate preference intact; turn it off using its toggle. Dashboard **Delete local data** clears it.
- **Focus Reading Mode:** open a substantive article, blog or documentation page and click **Enter Focus Reading Mode**. The isolated view preserves safe text structure and links. Press **Escape**, click **Exit Reading Mode** in the reader, or reopen the popup and use Exit to return. Original elements and event handlers remain intact; original focus and scroll position are restored. The reader reflects saved text size, spacing, dark/contrast settings. It is intentionally static and contains no animation. This mode is temporary to the current tab and is never automatically opened after refresh.

Reader extraction stays in the browser. No reader content is uploaded. It searches `article`, `main`, and `[role="main"]`, excludes forms/editors, hidden content, ads/navigation and embedded media, creates allowlisted elements from scratch, and accepts only HTTP(S)/mailto links. External links open a new tab; matching heading anchors stay inside the reader. Unsuitable or sensitive pages show a message without changing the page.

**Reader limits:** extraction is heuristic and uses up to 12 candidate containers, 12,000 nodes and 150,000 text characters per candidate. A candidate needs at least 160 characters and readable paragraphs/list/code blocks. Large articles may be shortened with a notice. Shadow-DOM articles, embedded documents/PDFs, media and app-only pages are not supported. Dynamic content is a snapshot: exit and reopen to refresh it. It does not replace a screen reader or provide complete accessibility compliance.

### Run the included demo webpage (requires Node.js 20.12+)

In a terminal, open the project root and run:

```bash
npm run demo
```

Then open **http://127.0.0.1:4173** in Chrome. This page deliberately has poor accessibility so you can see clear before/after changes. Using `127.0.0.1` rather than `localhost` also matches the prototype's hostname validation.

> There is no `npm install` step. No third-party npm packages are required.

## 3. Optional summary and speech backend

The summary and speech service runs outside the extension so that **API keys never enter a browser extension bundle**. Start it in a **second terminal**, from the project root:

```bash
npm run server
```

Check **http://127.0.0.1:3001/api/health**. Expect a small JSON response with `status: "ok"`.

### Configure summaries and Gnani speech

The backend automatically loads `backend/.env`; shell environment variables override it. Start from `backend/.env.example` on a fresh checkout. Never put keys in extension files.

- **Groq:** set `SUMMARY_PROVIDER=groq`, `GROQ_API_KEY`, and optionally `GROQ_MODEL` (default `llama-3.3-70b-versatile`).
- **xAI/Grok:** set `SUMMARY_PROVIDER=xai`, `XAI_API_KEY`, and optionally `XAI_MODEL` (default `grok-4.3`). An `xai-` key is for xAI, not Groq.
- **Gnani:** set `GNANI_API_KEY`. Defaults are `GNANI_MODEL=timbre-v2.5`, `GNANI_VOICE=Kaveri`, and `GNANI_LANGUAGE=en-IN` for English speech.
- Legacy OpenAI support remains available using `SUMMARY_PROVIDER=openai` and `OPENAI_API_KEY`.

Restart `npm run server` after changing configuration. `npm run providers:check` makes two small **live, billable** requests using fixed sample text and reports provider status without printing keys.

### Summarize and read aloud — persistent workspace

1. Reload WEBBY in `chrome://extensions` and refresh the website after installing updated extension files.
2. Open the popup → **Summarize & read aloud** → **Load page text for preview**. Review or edit the locally extracted text (up to 12,000 characters); loading it does **not** upload anything.
3. Check the explicit consent box and click **Summarize**. WEBBY opens a **persistent reading tab** and starts the summary there. Closing the small popup does not interrupt the request.
4. When the summary finishes, it is stored **only in Chrome session storage**, keyed to the original browser tab and exact page URL. Close the popup or workspace, reopen WEBBY on that website, and the draft and summary will reappear. The explicit provider consent checkbox must be checked again before another upload.
5. **Read text aloud** and **Read summary** also open the persistent tab. Playback continues even if the small popup is dismissed; audio stops if the persistent tab is closed.
6. **Clear saved** deletes the draft/summary; this data also disappears on browser restart, closing the original source tab, or navigating that tab to a different URL (where Chrome exposes the URL update).

**Privacy:** Reading data stays in extension-local session storage, not cloud sync. It is sent to the configured provider only after an explicit consented action. Audio is never stored. Extraction excludes forms, editors, hidden elements, and navigation; sensitive-page blocking is heuristic, so always review the preview before sharing. Providers may retain submitted content under their own policies. Stopping cannot recall text already sent.

### Colour Vision Support — testing the 10 plates

1. Popup → **Accessibility controls** → **Colour Vision Support** → **Start Assessment**.
2. Confirm you see **10 questions**. For a functional check, use the development answer key below (plate order from this release): `12, 8, 29, 5, 3, 15, 6, 45, 73, 26`. **Do not show this answer key to real participants.**
3. Test **Previous/Next**, answer editing, **I can't see a number**, and **Review answers**. All questions must have an answer or the explicit unable option before submission.
4. Submit all correct answers: you should see **10 scored, 10 correct**, with no medical classification. Repeat with one incorrect answer and then an unable answer to verify counts change.
5. Choose a palette in the results, click **Apply My Preference**, return to a content-rich website, and verify prose links/buttons/alerts are adapted while navigation, search controls and search-result titles are not forcibly underlined.
6. Disable or clear the colour preference, reload the site, and confirm colour-specific styles revert without removing other WEBBY settings.

These are **non-clinical, screen-dependent visual discrimination plates**. Correct-answer counts cannot establish protanopia, deuteranopia, tritanopia, or other diagnoses. Use the results to choose a comfortable palette.

### Backend endpoint

- `GET /api/health` reports summary and speech configuration.
- `POST /api/summarize` returns a summary; `POST /api/speech` returns WAV audio.
- Server binds to `127.0.0.1:3001` only; browser CORS is restricted to `chrome-extension://...` origins, not arbitrary websites.
- The frontend backend URL is currently fixed in `extension/dashboard.js` and `extension/reading-ui.js`. Change both if needed, and update the manifest host permission.

## 4. Demo walkthrough (~5 minutes)

1. Run `npm run demo`, load the extension and open `http://127.0.0.1:4173`.
2. Read the original article: gray 11px text, tight spacing, floating animation.
3. In the popup choose **125% font**, **1.75× line height**, **Dark mode**, **High contrast**, **Reduce motion**, **Focus assist**, then **Save for this website**.
4. Confirm that paragraph text grows, contrast improves, the animated graphic stops, and Tab shows a visible focus outline.
5. Refresh the page and confirm the saved site settings persist.
6. Open the dashboard, choose **Preferences**, and verify the website appears under Website customizations.
7. Optionally start `npm run server`, load a text preview, grant shared reading permission, and test Summarize or Read text aloud.
8. Click **Reset** in the popup to remove per-site overrides, or pause WEBBY from dashboard Preferences to restore original styling.

## 5. Repository guide

```text
WEBBY_Complete_Prototype/
├── README.md                         ← you are here
├── package.json                      ← scripts; zero npm dependencies
├── extension/                        ← select THIS folder in Load unpacked
│   ├── manifest.json                 ← permissions / MV3 registration
│   ├── background.js                 ← message router and site settings
│   ├── content.js                    ← inspection and reversible DOM adaptation
│   ├── content.css                   ← dark mode, reduced motion and keyboard focus rules
│   ├── popup.html / .js / .css       ← quick controls and reading tools
│   ├── dashboard.html / .js / .css   ← full settings dashboard
│   ├── ui.css                        ← shared visual styles
│   ├── assets/                       ← WEBBY icons
│   └── shared/
│       ├── contracts.js              ← profile and site override validation
│       ├── storage.js                ← chrome.storage.local data repository
├── backend/
│   ├── server.js                      ← loopback-only JSON HTTP backend
│   └── .env.example                   ← example environment variables
├── demo/                              ← intentionally challenging static webpage
├── tools/serve-demo.js                ← demo static-server CLI
├── tools/check.js                     ← JS syntax + manifest validation
├── tests/                             ← unit and HTTP integration tests
└── docs/
    ├── LLM_HANDOFF.md                 ← upload with README to the next coding LLM
    ├── ARCHITECTURE.md
    ├── API_CONTRACT.md
    ├── TESTING.md
    ├── SECURITY.md
    └── ORIGINAL_PROPOSAL.pdf          ← user's original 10-slide presentation
```

## 6. Tests and code health

```bash
npm run verify    # syntax + manifest checks, followed by all automated tests
npm test          # Node.js built-in test runner
npm run check     # syntax + manifest only
```

Tests are network-free and require no database or AI key. The HTTP integration test starts an ephemeral test server and confirms reading responses, malformed-request handling, and rejection of untrusted origins.

For browser-specific validation see **[docs/TESTING.md](docs/TESTING.md)**. Headless browser loading and a real Chrome click-through are not included in the automated suite. They should be carried out on the teammate's own machine.

## 7. Implementation choices

The original 10-page WEBBY proposal describes a Chrome MV3 extension, TypeScript/DOM adaptation, a Node/Express and LLM AI engine, Next.js dashboard, a local data layer and optional Supabase sync. This MVP preserves the functional architecture but intentionally uses:

- **Plain modern JavaScript and browser-native APIs** for an extension anyone can load without a build tool or npm installation. This is a scope reduction from TypeScript/React, not a statement about the original proposal.
- **Node built-in `http`** instead of Express. Equivalent API flow, fewer dependencies.
- **Extension options dashboard** instead of a separately hosted Next.js app so that local storage, privacy settings, and site overrides work immediately.
- **Local storage** only, no login, no Supabase, no cross-device sync.
- Summaries and speech use a reviewed text preview with shared, session-only consent.

These changes are made to deliver a real, transferable prototype quickly, not to redefine WEBBY's longer-term goals.

## 8. Known limitations

- **Prototype, not certification:** WEBBY does not guarantee WCAG compliance or full support for all user needs or all websites.
- **Visual styling limitations:** High-contrast correction is best-effort only on known solid backgrounds. Dark mode uses a reversible page-level color filter and counter-filters common media; complex sites, fixed/sticky layouts, unusual filters, and custom embedded content can still need site-specific tuning.
- **Text scaling limits:** The extension modifies up to 1,400 eligible text elements per pass to limit performance impact. Unusual nested styles may still look imperfect. Forms and editors are deliberately excluded.
- **Dynamic content:** A MutationObserver detects added elements, but complex virtualized frontends, iframes, shadow DOM, cross-origin frames, and sites with aggressive styling are not fully supported.
- **No form editing:** Inputs, passwords, editors and reading on payment/login pages are blocked or skipped for safety.
- **No cloud:** Preferences remain on the current device/browser profile; reinstalling or clearing data may erase them.
- **Summaries and speech are optional:** They require a running backend and configured provider keys.
- **Local service:** The backend uses origin-based CORS and loopback binding. It does not implement production-grade authentication, rate limiting, security monitoring, deployment or accounts.

## 9. Handing this to the next developer or AI assistant

**Send the full ZIP** with `README.md` and `docs/LLM_HANDOFF.md`. The other member should upload those two Markdown files plus the relevant source files (or the whole repository if supported) to their coding LLM. The LLM handoff document gives the complete implemented state, interfaces, file ownership map, limitations and prioritized backlog.

For example:

> I am continuing the existing WEBBY browser extension prototype. Read `README.md`, `docs/LLM_HANDOFF.md`, and the source repository completely. Do not start a new project or replace working modules. First run `npm run verify`, review architecture and security constraints, then propose and implement the next backlog item with tests. Preserve Manifest V3, local-first storage, shared summary/speech consent and strict profile validation.

**Next sensible priorities:** real Chrome browser click-through + compatibility fixes, automated browser tests, page compatibility, shadow DOM handling, accessible UI audit, and (later) typed sources/React + cloud sync.

---

Created from the user's *WEBBY — AI-Powered Adaptive Accessibility for the Web* proposal. Original proposal content and MVP-specific engineering choices are distinguishable throughout the documentation.

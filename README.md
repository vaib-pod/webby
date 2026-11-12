# WEBBY — Working Prototype (v1.0)

**AI-powered adaptive accessibility for the web**  
*“Don't adapt yourself to the website. Let the website adapt to you.”*

WEBBY is a **local-first Chrome/Chromium Manifest V3 extension** that applies reversible accessibility adaptations to ordinary webpages based on user preferences. A separate, optional Node.js API can make constrained AI recommendations from a privacy-minimized **structural** page summary. The **Accessibility Twin** learns only from explicit feedback and saves adjustments per website.

**This is executable source code, not a slide mockup.** The extension runs directly from the `extension/` folder, with no bundling, package downloads, cloud account or database. The dashboard is an extension options page. The backend uses Node's built-in HTTP server. This intentionally differs from the original proposal's aspirational Next.js + Express + Supabase stack; see [Implementation choices](#implementation-choices).

## 1. What's included

| Module | Implemented feature | Files |
|---|---|---|
| Chrome extension | MV3 manifest, content script, service worker, popup | `extension/manifest.json`, `content.js`, `background.js`, `popup.*` |
| Rule-based adaptations | Text scale, line height, high-contrast readable text, reversible dark mode, reduced motion, keyboard focus | `extension/content.js`, `content.css` |
| Automatic reapplication | Detect added DOM nodes and reapply after a short debounce | `extension/content.js` |
| Reversible changes | Preserve/reinstate original inline styles when off or settings change | `extension/content.js` |
| Personal Accessibility Profile | Persistent local preferences and per-site overrides | `extension/shared/storage.js`, `shared/contracts.js` |
| Accessibility Twin | Feedback increases text/spacing, activates contrast/motion per site; history | `extension/shared/twin.js` |
| Settings dashboard | Overview, preferences with preview, site overrides, feedback, privacy controls | `extension/dashboard.*`, `ui.css` |
| AI analysis | Opt-in structural snapshot, constrained AI actions, local offline fallback | `backend/server.js`, `backend/ai.js`, `extension/background.js` |
| Privacy guard | No raw text, HTML, URL or form values in AI request; block sensitive page types | `extension/content.js`, `shared/contracts.js` |
| Demo | Intentionally low-contrast, small-text, animated test page | `demo/` |
| Tests | Validation, AI allowlisting, feedback learning, HTTP endpoints and CORS | `tests/` |
| Handoff | Architecture, contracts, testing steps, future work, detailed LLM context | `docs/` |

**Test status in this package:** 15/15 automated tests passed; JS syntax and Manifest V3 metadata validated. A browser-based, user-interactive QA pass is still recommended: automated unit tests cannot prove compatibility with real sites. AI provider output has not been verified with a real paid key.

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

The rule-based accessibility features, dashboard, preferences and Twin **work without the AI server**. Chrome doesn't allow content scripts on internal pages like `chrome://extensions` or the Chrome Web Store; that is expected.

### Run the included demo webpage (requires Node.js 20+)

In a terminal, open the project root and run:

```bash
npm run demo
```

Then open **http://127.0.0.1:4173** in Chrome. This page deliberately has poor accessibility so you can see clear before/after changes. Using `127.0.0.1` rather than `localhost` also matches the prototype's hostname validation.

> There is no `npm install` step. No third-party npm packages are required.

## 3. Optional local AI backend

The AI engine runs outside the extension so that **API keys never enter a browser extension bundle**. Start it in a **second terminal**, from the project root:

```bash
npm run server
```

Check **http://127.0.0.1:3001/api/health**. Expect a small JSON response with `status: "ok"`.

### Enable real AI recommendations

You need an API key for an OpenAI-compatible use of OpenAI's Chat Completions endpoint. Set the environment variable **in the terminal that starts the backend**, not in the browser:

**Windows PowerShell**
```powershell
$env:OPENAI_API_KEY="YOUR_KEY_HERE"
$env:OPENAI_MODEL="gpt-4o-mini"
npm run server
```

**macOS / Linux**
```bash
export OPENAI_API_KEY="YOUR_KEY_HERE"
export OPENAI_MODEL="gpt-4o-mini"
npm run server
```

The included `backend/.env.example` is a reference only; the project does **not** automatically load `.env`. Export the variables as shown, or use a trusted environment management workflow.

Then in the WEBBY popup:

1. Check **AI analysis consent** (you can withdraw consent at any time).
2. Click **Analyze this page** on an ordinary, non-sensitive webpage.
3. WEBBY sends only structural roles/tags, issue types, and a page category to `http://127.0.0.1:3001/api/analyze`.
4. The server, if configured with a key, forwards that minimized JSON to the AI provider. It returns suggestions from a fixed allowlist. WEBBY independently validates the result before applying it.
5. If the server/key/provider is unavailable, the UI explicitly shows **rule-based fallback**, not a fake AI result.

**Privacy warning:** Consent applies to every future manual **Analyze** click until withdrawn. No automatic or passive AI uploads happen. This implementation does not transmit full URLs, page text, password or form data. Although the structural summary is minimized, it can still reveal broad aspects of a page; do not opt in if that is unacceptable.

### Backend endpoint

- `GET /api/health` → `{status:"ok",aiConfigured:boolean,version:1}`
- `POST /api/analyze` → `{version:1,source:"ai"|"fallback",actions:[],reasons:[]}`
- Server binds to `127.0.0.1:3001` only; browser CORS is restricted to `chrome-extension://...` origins, not arbitrary websites.
- The frontend backend URL is currently fixed in `extension/background.js` and `extension/dashboard.js`. Change both if needed, and update the manifest host permission.

## 4. Demo walkthrough (~5 minutes)

1. Run `npm run demo`, load the extension and open `http://127.0.0.1:4173`.
2. Read the original article: gray 11px text, tight spacing, floating animation.
3. In the popup choose **125% font**, **1.75× line height**, **Dark mode**, **High contrast**, **Reduce motion**, **Focus assist**, then **Save for this website**.
4. Confirm that paragraph text grows, contrast improves, the animated graphic stops, and Tab shows a visible focus outline.
5. Click **A+ Text too small**. The Accessibility Twin increases the site's text setting one step. Refresh and confirm it persists.
6. Open the dashboard, choose **Accessibility Twin**, and verify the website appears and the feedback event is listed.
7. Optionally start `npm run server`, opt into AI, and click **Analyze this page**. You should get safe action recommendations. Without an API key they will be clearly marked as fallback.
8. Click **Reset** in the popup to remove per-site overrides, or disable WEBBY for the site to restore its original page styling.

## 5. Repository guide

```text
WEBBY_Complete_Prototype/
├── README.md                         ← you are here
├── package.json                      ← scripts; zero npm dependencies
├── extension/                        ← select THIS folder in Load unpacked
│   ├── manifest.json                 ← permissions / MV3 registration
│   ├── background.js                 ← message router and optional AI fetch
│   ├── content.js                    ← inspection and reversible DOM adaptation
│   ├── content.css                   ← dark mode, reduced motion and keyboard focus rules
│   ├── popup.html / .js / .css       ← quick controls, Twin feedback, AI opt-in
│   ├── dashboard.html / .js / .css   ← full settings dashboard
│   ├── ui.css                        ← shared visual styles
│   ├── assets/                       ← WEBBY icons
│   └── shared/
│       ├── contracts.js              ← schemas, profiles, action allowlist, fallback
│       ├── storage.js                ← chrome.storage.local data repository
│       └── twin.js                   ← explicit feedback → override logic
├── backend/
│   ├── server.js                      ← loopback-only JSON HTTP backend
│   ├── ai.js                          ← AI provider, conservative prompt, fallback
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

Tests are network-free and require no database or AI key. The HTTP integration test starts an ephemeral test server and confirms fallback output, 400 for malformed requests, and rejection of untrusted origins.

For browser-specific validation see **[docs/TESTING.md](docs/TESTING.md)**. Headless browser loading and a real Chrome click-through are not included in the automated suite. They should be carried out on the teammate's own machine.

## 7. Implementation choices

The original 10-page WEBBY proposal describes a Chrome MV3 extension, TypeScript/DOM adaptation, a Node/Express and LLM AI engine, Next.js dashboard, a local data layer and optional Supabase sync. This MVP preserves the functional architecture but intentionally uses:

- **Plain modern JavaScript and browser-native APIs** for an extension anyone can load without a build tool or npm installation. This is a scope reduction from TypeScript/React, not a statement about the original proposal.
- **Node built-in `http`** instead of Express. Equivalent API flow, fewer dependencies.
- **Extension options dashboard** instead of a separately hosted Next.js app so that local storage, privacy settings, and site overrides work immediately.
- **Deterministic Accessibility Twin** driven by explicit user feedback instead of opaque ML behavior.
- **Local storage** only, no login, no Supabase, no cross-device sync.
- **AI context = structure and detected issues**, not page text. This is a privacy-first tradeoff: richer semantic comprehension of articles and images would need a separate, explicit content-sharing design and additional safeguards.

These changes are made to deliver a real, transferable prototype quickly, not to redefine WEBBY's longer-term goals.

## 8. Known limitations

- **Prototype, not certification:** WEBBY does not guarantee WCAG compliance or full support for all user needs or all websites.
- **Visual styling limitations:** High-contrast correction is best-effort only on known solid backgrounds. Dark mode uses a reversible page-level color filter and counter-filters common media; complex sites, fixed/sticky layouts, unusual filters, and custom embedded content can still need site-specific tuning.
- **Text scaling limits:** The extension modifies up to 1,400 eligible text elements per pass to limit performance impact. Unusual nested styles may still look imperfect. Forms and editors are deliberately excluded.
- **Dynamic content:** A MutationObserver detects added elements, but complex virtualized frontends, iframes, shadow DOM, cross-origin frames, and sites with aggressive styling are not fully supported.
- **No form editing:** Inputs, passwords, editors and payment/login analysis are blocked or skipped for safety.
- **No cloud:** Preferences remain on the current device/browser profile; reinstalling or clearing data may erase them.
- **AI is an optional add-on:** Requires a running backend and provider key for actual provider-generated responses. Every AI action is bounded and validated.
- **Offline mode is not machine learning:** The rule-based fallback is explicitly labeled and still provides useful adaptations.
- **Local service:** The backend uses origin-based CORS and loopback binding. It does not implement production-grade authentication, rate limiting, security monitoring, deployment or accounts.

## 9. Handing this to the next developer or AI assistant

**Send the full ZIP** with `README.md` and `docs/LLM_HANDOFF.md`. The other member should upload those two Markdown files plus the relevant source files (or the whole repository if supported) to their coding LLM. The LLM handoff document gives the complete implemented state, interfaces, file ownership map, limitations and prioritized backlog.

For example:

> I am continuing the existing WEBBY browser extension prototype. Read `README.md`, `docs/LLM_HANDOFF.md`, and the source repository completely. Do not start a new project or replace working modules. First run `npm run verify`, review architecture and security constraints, then propose and implement the next backlog item with tests. Preserve Manifest V3, local-first storage, explicit AI consent and strict action allowlisting.

**Next sensible priorities:** real Chrome browser click-through + compatibility fixes, automated browser tests, per-element AI action targets, better rule calibration, shadow DOM handling, accessible UI audit, and (later) typed sources/React + cloud sync.

---

Created from the user's *WEBBY — AI-Powered Adaptive Accessibility for the Web* proposal. Original proposal content and MVP-specific engineering choices are distinguishable throughout the documentation.

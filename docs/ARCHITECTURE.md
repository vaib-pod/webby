# WEBBY v1 — Technical Architecture

## Product origin

The ten-page WEBBY deck proposes: **Website → Extension → Privacy Filter → Rules + AI Analysis → Profile/Twin → Adaptation Decision → Validation → Adapted Website**, with user feedback returning to the Twin (proposal slides 4 and 8). The deck also proposes rules for measurable adaptations, AI for semantic/contextual decisions, local-first profile storage and opt-in syncing (slides 7 and 9). WEBBY v1 implements a privacy-minimized, locally runnable version of this architecture.

## Module and message flow

```text
   Website (http/https)
          |
          v
   extension/content.js
     |       |             local on every ordinary page
     |       +--> scan computed styles, categorize page
     +----------> apply reversible inline CSS + focus/motion stylesheet
          |
          | chrome.runtime.sendMessage (no raw DOM)
          v
   extension/background.js  <------ extension/popup.js & dashboard.js
          |                          |               |
          |                          +----- user inputs + consent
          v
   extension/shared/storage.js -----> chrome.storage.local
          |                                   |
          +---- twin.js (explicit feedback)---+
          |
          | user-clicked AI request AND AI consent only
          v
   /api/analyze on 127.0.0.1:3001
          |
          +--> strict structural input validation (contracts.js)
          +--> OpenAI Chat Completions (only if key configured)
          +--> deterministic fallback (otherwise)
          |
          v
   allowlisted JSON actions <---- validated by server and background
          |
          v
   content.js (validates AGAIN) -> temporary reversible adaptations
```

## 1. Content script

- Run by the browser automatically when `http://*/*` or `https://*/*` loads.
- `reloadProfile()` requests the effective profile (global + domain override) from the background.
- `apply()` restores all previous WEBBY inline changes before reapplying the current settings. Original inline value and `!important` priority are captured once in a WeakMap and restored exactly.
- Targets limited to readable text/heading/linked controls (1,400 per pass). Forms, textboxes, editors, SVG, canvas, preformatted text, embeds, etc. are excluded.
- Motion/focus enhancement are controlled by scoped document attributes and `content.css`.
- MutationObserver watches added DOM nodes and debounces reapplication.
- `samplePage()` temporarily removes adaptation, captures coarse role/tag/issue information from up to 30 sampled visible elements, and restores the current adaptation. It collects no actual page text.
- `isSensitive()` disables optional AI analysis on pages with password/payment-related inputs and certain sensitive pathnames.

**Caution:** Page style analysis is a heuristic, not an automated WCAG conformance audit. CSS can still be complex, and some backgrounds are not known.

## 2. Background service worker

Sole `chrome.runtime.onMessage` router. Messages use `{type: ..., ...}` request and `{ok: true, data: ...}` / `{ok:false,error:...}` response. The service worker reads/writes local preferences, coordinates feedback, and fetches optional backend results. It rejects senders not belonging to the extension.

**AI request sequence:** popup sends `ANALYZE_WITH_AI` with a tab ID → background confirms opt-in → checks target tab is http(s) → requests content script's `GET_PAGE_SUMMARY` → rejects flagged sensitive pages → validates summary → sends to backend → re-validates action response → applies through `APPLY_AI_ACTIONS` → stores hostname, timestamp, action count, and `ai`/`fallback` source only.

## 3. Shared contracts

`shared/contracts.js` is an ES module imported by both the Chrome service worker and Node backend. A single file controls profile constraints, page shape, AI action allowlist and deterministic fallback. Do not make uncoordinated copies of the contract.

`shared/storage.js` uses Chrome's `chrome.storage.local` (key names: `webbyProfile`, `webbyOverrides`, `webbyFeedback`, `webbyAiConsent`, `webbyAnalysisHistory`). Storage validation is also applied on reads. The `chrome.storage.onChanged` event causes content scripts to refresh their visible state when global or site settings change.

`shared/twin.js` does not track clicks, scrolling, browsing history or disabilities. It converts a **specific user feedback button** into a per-site patch and appends feedback history (maximum 250 entries).

## 4. Backend

- Built on Node's HTTP server, no external dependencies.
- Binding address: `127.0.0.1` by default (port 3001).
- If `OPENAI_API_KEY` exists: calls `https://api.openai.com/v1/chat/completions` with a conservative system prompt and JSON response format. The model is configurable with `OPENAI_MODEL`.
- Without key, or after an AI timeout/failure/invalid response: deterministic fallback with `source: "fallback"`.
- Schema validation discards unknown structured fields; only action types and parameters on the allowlist survive.
- There is deliberately no `eval`, arbitrary injected CSS, selector code, DOM string injection, remote JavaScript loading or account tracking.

## 5. Data flow / trust boundaries

| Boundary | Trusted | Untrusted | Controls |
|---|---|---|---|
| Website → content | Extension code | Website DOM and styles | Use coarse types, no raw text, skip forms and sensitive pages |
| Popup → background | Extension origin | User-entered settings | Validate profile ranges and hostname |
| Content → background | Extension content script | Page summary may reflect untrusted DOM | Validate summary schema, cap arrays, strip fields |
| Background → backend | Local extension | Network/API response | Loopback, finite timeout, strict action validation |
| Backend → provider | Code and system prompt | Provider output | JSON parsing, allowlist, bounds, no direct code execution |
| Storage → content | Local browser storage | Potential corrupt old values | Validate read values and restore defaults |

## 6. Why no Next.js/React/TypeScript/Express yet?

The pitch lists those as proposed technologies. The prototype prioritizes **a verifiable working extension with zero install dependencies**, rather than spending development time on bundling, syncing and authentication. This is a deliberate MVP implementation decision, not a claim that the pitch used native JavaScript. The next developer can migrate to typed code and a component framework while preserving the existing contracts and test suite.

## 7. Code change rules for future developers

1. Do not change the request/response shape without updating `extension/shared/contracts.js`, `backend/ai.js`, `background.js`, and tests.
2. Never put AI provider keys in the extension directory or source control.
3. Never let AI return/execute HTML, CSS, JavaScript, XPath, arbitrary selectors, or browser scripting.
4. Keep AI off until a user explicitly consents and clicks Analyze.
5. Keep all adaptations reversible and forms/editors safely excluded.
6. Local persistence must work completely without backend/network/cloud.
7. Run `npm run verify` after each change and test actual browser UX for any UI/content changes.

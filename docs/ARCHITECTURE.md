# WEBBY v1 — Technical Architecture

## Product origin

WEBBY adapts websites through a browser extension, local preferences, reading presets and optional summaries and speech. Saved global and per-site settings control reversible page changes.

## Module and message flow

```text
Popup / Dashboard -> Background -> Validated local profiles and site overrides
                              -> Content script -> Reversible reading styles
Popup reading preview -> Shared summary / speech consent
                      -> Local backend -> Summary provider / Gnani speech
```

## 1. Content script

- Run by the browser automatically when `http://*/*` or `https://*/*` loads.
- `reloadProfile()` requests the effective profile (global + domain override) from the background.
- `apply()` restores all previous WEBBY inline changes before reapplying the current settings. Original inline value and `!important` priority are captured once in a WeakMap and restored exactly.
- Targets limited to readable text/heading/linked controls (1,400 per pass). Forms, textboxes, editors, SVG, canvas, preformatted text, embeds, etc. are excluded.
- Motion/focus enhancement are controlled by scoped document attributes and `content.css`.
- MutationObserver watches added DOM nodes and debounces reapplication.
- `isSensitive()` blocks reading-text extraction and Focus Reading Mode on pages with password/payment-related inputs and certain sensitive pathnames.

**Caution:** Page style analysis is a heuristic, not an automated WCAG conformance audit. CSS can still be complex, and some backgrounds are not known.

## 2. Background service worker

Sole `chrome.runtime.onMessage` router. Messages use `{type: ..., ...}` request and `{ok: true, data: ...}` / `{ok:false,error:...}` response. The service worker reads/writes local preferences, coordinates site settings and reading-tool preferences. It rejects senders not belonging to the extension.

**Reading request sequence:** the popup loads a local preview, verifies that the tab has not navigated, and sends reviewed text to the backend only after the shared reading permission and button click.

## 3. Shared contracts

`shared/contracts.js` is an ES module imported by both the Chrome service worker and Node backend. A single file controls profile and override constraints. Do not make uncoordinated copies of the contract.

`shared/storage.js` uses Chrome's `chrome.storage.local` (key names: `webbyProfile`, `webbyOverrides`). Storage validation is also applied on reads. The `chrome.storage.onChanged` event causes content scripts to refresh their visible state when global or site settings change.


## 4. Backend

Colour Vision Support is independent of the backend. `colour-vision.*` provides the extension-local manual/assessment/settings workspace; `shared/colour.js` validates separate presentation preferences and scores only verified manifest entries. `colour-content.js` is a classic content-script helper loaded before `content.js`; its changes share the existing snapshot/restore transaction. `shared/twin.js` combines effective website settings with confirmed colour preferences as a read-only local API, without restoring the removed Twin UI/inference engine. See [Colour Vision Support](COLOUR_VISION.md) for data flow, asset verification and coverage limits.

- Built on Node's HTTP server, no external dependencies.
- Binding address: `127.0.0.1` by default (port 3001).
- `backend/config.js` loads the ignored backend `.env` with shell overrides. `providers.js` selects Groq, xAI or legacy OpenAI using `SUMMARY_PROVIDER`; fixed provider endpoints keep credentials routed to their intended services.
- `reading-ui.js` requests `GET_READING_TEXT` for local preview and uses Chrome storage.session to retain the reviewed draft and completed summary per source tab. Summarize and speech actions in the ephemeral popup create an extension-owned `reading-workspace.html` tab, carrying a time-limited, one-shot requested action; the workspace performs `/api/summarize` or `/api/speech` after checking source navigation and sensitive state. Closing the popup does not abort this persistent tab. Audio stops if the workspace itself closes; Stop cancels browser requests. The session cache is cleared explicitly or when the source tab closes.
- Reading endpoints validate consent and text limits; provider failures return errors rather than fabricated summaries/audio. Gnani uses `X-API-Key-ID` and returns binary WAV.
- There is deliberately no `eval`, arbitrary injected CSS, selector code, DOM string injection, remote JavaScript loading or account tracking.

## 5. Data flow / trust boundaries

| Boundary | Trusted | Untrusted | Controls |
|---|---|---|---|
| Website → content | Extension code | Website DOM and styles | Manual reading preview excludes forms/hidden content and blocks sensitive pages |
| Popup → background | Extension origin | User-entered settings | Validate profile ranges and hostname |
| Popup to backend | Local extension | Network/API response | Loopback, shared reading consent, finite timeouts, bounded text |
| Backend → provider | Code and system prompt | Provider output | Text-only summary display, WAV validation, no direct code execution |
| Storage → content | Local browser storage | Potential corrupt old values | Validate read values and restore defaults |

## 6. Why no Next.js/React/TypeScript/Express yet?

The pitch lists those as proposed technologies. The prototype prioritizes **a verifiable working extension with zero install dependencies**, rather than spending development time on bundling, syncing and authentication. This is a deliberate MVP implementation decision, not a claim that the pitch used native JavaScript. The next developer can migrate to typed code and a component framework while preserving the existing contracts and test suite.

## 7. Code change rules for future developers

1. Do not change the request/response shape without updating the relevant shared validator, reading UI, backend handler, and tests.
2. Never put AI provider keys in the extension directory or source control.
3. Never let AI return/execute HTML, CSS, JavaScript, XPath, arbitrary selectors, or browser scripting.
4. Require shared permission and a manual action before sending text for summary or speech.
5. Keep all adaptations reversible and forms/editors safely excluded.
6. Local persistence must work completely without backend/network/cloud.
7. Run `npm run verify` after each change and test actual browser UX for any UI/content changes.

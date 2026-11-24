# WEBBY - Current development handoff

## Current product

WEBBY is an existing Chrome Manifest V3 extension with local reading preferences, per-site settings, presets, a reading ruler, Focus Reading Mode, optional summaries and read aloud. Continue this repository rather than generating a new app.

The popup now contains presets, accessibility controls, reading tools, and summary/speech controls. The user removed Accessibility Twin, Adaptive mode, and AI suggestions to reduce clutter. Their dedicated UI and page-analysis code have been removed; do not reintroduce them without a request.

## Modules

Colour Vision Support is now implemented at the user's request. See `docs/COLOUR_VISION.md` for the confirmed ten-plate key, safe manifest extension, scoring safeguards and test instructions. `extension/colour-vision.*` owns the dedicated local workspace, `colour-content.js` applies reversible palette/structural cues through the existing snapshot controller, and `shared/colour.js` owns strict colour preferences/scoring. The new `shared/twin.js` is only a read-only combined-preference API; the old Twin UI/inference engine remains absent. Do not store colour-vision categories or individual activity answers, and do not interpret scores as diagnoses.

- extension/popup.*: current-site controls, presets and reading tools.
- extension/reading-ui.js: preview, shared reading permission, requests and playback.
- extension/dashboard.*: overview, global preferences, website customizations and service/privacy information.
- extension/background.js: validated settings and reading-tool message routing.
- extension/content.js and content.css: reversible page styles, ruler, focus reader and text extraction.
- extension/shared/contracts.js: validated profile and override schemas.
- extension/shared/storage.js: local profile, site overrides and ruler preferences.
- extension/shared/presets.js: preset values and matching.
- extension/shared/reading.js: reading text validation and speech chunking.
- backend/server.js: loopback health, summary and speech endpoints.
- backend/config.js and providers.js: ignored local configuration and summary provider routing.
- backend/reading.js: summary prompts and Gnani WAV synthesis.
- tests/: Node tests; tools/browser-check.js and accessibility-fixtures.js: real Chrome checks with mocked extension APIs and providers.

## Behavior to preserve

- Reading Mode uses 120% text and 1.8 spacing; Low Vision uses 145%, 1.9 and high contrast; Calm Mode uses 115%, 1.75, reduced motion and warm colors.
- Calm Mode warms neutral page surfaces and the focus reader. Colored controls retain their contrast.
- Repeated preset applications must use original page font sizes. Temporarily suppress transitions during reset/measurement/application; restore page transitions afterward.
- Save for this site applies and persists manual controls. Reset removes only that site's profile override and restores global settings. Ruler preferences are separate.
- Global enable/pause remains in dashboard Preferences. Saving popup controls or selecting a preset enables those settings for the current site, including previously paused sites.
- Focus Reading Mode is temporary to the tab, restores original DOM/focus/scroll on exit, and never grants shared reading permission.
- Loading a preview stays local. Clicking Summarize or Read aloud with explicit consent opens reading-workspace.html, which survives closing the popup. Draft and summary are cached in Chrome storage.session per source tab/URL, not in storage.local. Never upload without fresh explicit consent; Clear or closing the source tab deletes session data.
- Summaries currently use Groq via ignored backend/.env; Gnani handles speech. Keep keys out of source code, output, and extension bundles.

## Constraints

Preserve Manifest V3, dependency-free modules, validated settings, local persistence and reversible DOM changes. Do not rewrite forms, editable content or page semantics. Sensitive-page guards and preview filtering are heuristic; preserve them and let users review text before sharing.

Backend requests require consent and bounded text. Keep the backend bound to 127.0.0.1 and its existing extension-origin CORS checks. CORS is not authentication for local clients; this server is not hardened for public hosting. Provider responses must remain non-executable text or validated audio.

Do not claim model training, universal website compatibility, complete WCAG compliance, or comprehensive assistive-technology coverage. No cloud sync, account system or passive preference inference is implemented.

## Development and verification

Use npm run verify for syntax, manifest and Node checks. Use npm run browser:check for popup, dashboard, reading privacy, consent, playback, presets, warm colors, sizing stability and cleanup. Browser checks use mocked extension APIs and fixed provider responses; manually inspect the unpacked extension on real sites when relevant.

npm run demo serves the sample page. npm run server starts the optional summary/speech backend. npm run providers:check sends two fixed live samples and may consume provider credits. Restart the backend after configuration or server-code changes.

Read README.md, docs/API_CONTRACT.md, docs/ARCHITECTURE.md and docs/SECURITY.md for details. Update callers, validation, tests and documentation together when changing a contract.

Remaining work includes broader website compatibility, shadow DOM coverage, screen-reader and keyboard audits, and testing with users. Do not restore removed features as a backlog task.

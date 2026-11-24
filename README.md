<div align="center">
  <img src="extension/assets/icon128.png" alt="WEBBY leaf logo" width="80" height="80">
  <h1>WEBBY</h1>
  <p><strong>A more comfortable web, on your terms.</strong></p>
  <p>Personal reading settings, colour vision support, and optional summaries and speech.<br>Built for Chrome. Designed around your preferences.</p>
  <p>
    <img src="https://img.shields.io/badge/Chrome-Manifest_V3-267334?style=flat-square" alt="Chrome Manifest V3">
    <img src="https://img.shields.io/badge/Storage-Local--first-267334?style=flat-square" alt="Local-first storage">
    <img src="https://img.shields.io/badge/JavaScript-No_build_step-267334?style=flat-square" alt="JavaScript, no build step">
  </p>
  <p><a href="#get-started">Get started</a> · <a href="#features">Features</a> · <a href="#summaries--read-aloud">Summaries &amp; read aloud</a> · <a href="#development">Development</a></p>
</div>

---

WEBBY is a browser extension that helps you make websites easier to read and navigate. Adjust text and spacing, reduce visual distractions, compare colour palettes, or open an article in a focused reading view. Save what works for each website and carry your default preferences to new ones.

The extension runs directly from this repository. Reading controls, colour support, and saved preferences work without an account, API key, or running backend.

## Features

| Feature | What you can do |
| --- | --- |
| **Quick Modes** | Switch to Dark Mode, open the text-only Reading Mode, or apply Low Vision and Calm Mode presets. |
| **Accessibility controls** | Adjust text size and line spacing, improve text contrast, reduce motion, and highlight keyboard focus. |
| **Reading Ruler** | Follow your pointer or keyboard focus with a reading guide that stays out of the way of clicks and text selection. |
| **Colour Vision Support** | Compare Blue & amber, Purple & teal, and Graphite & patterns. Choose a palette manually or explore a local colour-vision activity. |
| **Website preferences** | Keep global defaults, save individual website settings, and manage them from the dashboard. |
| **Summaries & read aloud** | Review page text, request a summary, or listen in a dedicated reading tab that stays open when the popup closes. |
| **Reversible adjustments** | Change or disable adaptations and restore the original page styling. |

The popup keeps **Quick Modes** visible and groups the remaining controls into expandable sections.

## Get started

### Load the extension

1. Clone or download this repository. Extract it first if you downloaded a ZIP.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**, then choose **Load unpacked**.
4. Select the **`extension/`** folder inside this project.
5. Pin WEBBY from the extensions menu and open a regular website.
6. Refresh the webpage, then click WEBBY to choose your reading settings.

**No build step or `npm install` is required.** Node.js is only needed for the demo, optional backend, and development checks.

After updating the source, reload WEBBY at `chrome://extensions` and refresh your website tabs.

### Make it yours

- **For the current website:** expand Accessibility controls, adjust the settings, and choose **Save for this site**. Reading Ruler and Colour Vision Support are available in this section too.
- **For your defaults:** open the WEBBY dashboard and select **Preferences**. Website-specific settings take precedence over the global profile.
- **For focused reading:** choose **Reading Mode** on an article. Use **Exit Reading Mode** or press **Escape** to return to the original page.
- **For colour support:** compare the preview palettes and choose **Apply to Websites**. You can change, disable, or clear the preference from Colour settings.

Colour support preserves website-owned link colours so opened and unopened links remain distinguishable. Search/navigation elements and media retain their original appearance. Supported buttons, notices, and labelled HTML chart indicators receive the selected adaptations, including alongside Dark Mode.

The colour-vision activity is exploratory and **does not provide a medical diagnosis**. Individual answers are processed locally and discarded after scoring or leaving the activity.

### Try the demo

With **Node.js 20.12 or later**, run this from the project root:

```bash
npm run demo
```

Open [the local demo](http://127.0.0.1:4173) in Chrome. Try the presets, change text spacing, and toggle the ruler to compare the reading experience before and after applying WEBBY.

## Summaries & read aloud

These optional features use a local Node.js service. Provider keys stay in the backend, outside the extension bundle.

1. Copy [`backend/.env.example`](backend/.env.example) to `backend/.env` for a fresh setup.
2. Choose a summary provider and add the corresponding key. Add a Gnani key if you want speech.
3. Start the service from the project root:

```bash
npm run server
```

| Service | Configuration |
| --- | --- |
| **Groq summaries** | `SUMMARY_PROVIDER=groq` and `GROQ_API_KEY` |
| **xAI summaries** | `SUMMARY_PROVIDER=xai` and `XAI_API_KEY` |
| **OpenAI summaries** | `SUMMARY_PROVIDER=openai` and `OPENAI_API_KEY` |
| **Gnani speech** | `GNANI_API_KEY`; optional model, voice, and language settings are in the example file |

Restart the service after changing configuration. You can check its status in **Dashboard → Privacy & services**, or at the [local health endpoint](http://127.0.0.1:3001/api/health).

To use it, expand **Summarize & read aloud** in the popup, load the page text, review or edit it, and grant permission before choosing an action. A dedicated reading tab handles the request and playback, so dismissing the popup does not interrupt them. Closing the reading tab stops its audio playback.

Drafts and completed summaries use temporary browser session storage. **Clear saved** removes them; they also expire on browser restart or when the source tab closes. Provider permission must be granted again before a new upload.

Keep `backend/.env` private. It is excluded by `.gitignore`. The backend is intended to run locally at `127.0.0.1:3001`.

## Privacy & control

- **On-device preferences:** global settings, website overrides, ruler settings, and confirmed colour preferences are stored locally.
- **Explicit sharing:** loading page text is local. Summary and speech providers receive reviewed text only after you grant permission and request an action.
- **No saved colour diagnoses:** WEBBY stores the chosen palette and its settings, not a medical category or individual activity answers.
- **Your data, your choice:** reset website customizations, clear colour preferences, clear reading drafts, or delete local WEBBY data from the dashboard.

See [Privacy & security](docs/SECURITY.md) for storage details, provider considerations, and the limits of sensitive-page detection.

## Development

Built with **JavaScript, HTML, CSS, Chrome Manifest V3, and Node.js built-in APIs**. There are no third-party npm dependencies.

```text
extension/   Browser extension, popup, dashboard, reading workspace, and colour support
backend/     Local summary and speech service
demo/       Sample webpage for trying accessibility controls
tests/      Unit and integration tests
tools/      Validation, browser checks, and development utilities
docs/       Architecture, API contracts, testing, and feature documentation
```

Run commands from the project root:

| Command | Purpose |
| --- | --- |
| `npm run verify` | Validate JavaScript and the manifest, then run the unit and integration tests. |
| `npm test` | Run the Node.js test suite. |
| `npm run browser:check` | Exercise UI and content-script behaviour in headless Chrome with mocked extension APIs and providers. |
| `npm run extension:check` | Install WEBBY in a disposable Chrome profile and verify real colour-setting application, persistence, and restoration. |
| `npm run demo` | Serve the included demo webpage. |
| `npm run server` | Start the optional local backend. |
| `npm run providers:check` | Check configured providers with small live requests; provider charges may apply. |

Browser checks require Chrome. The default executable path targets Windows; set `WEBBY_BROWSER` to your Chrome executable when using a different installation. Automated checks do not require provider keys, except for the explicitly live `providers:check` command.

When contributing, keep adaptations reversible, preserve keyboard navigation and website behaviour, and include relevant tests. Run `npm run verify` before submitting changes, plus browser checks when changing the extension UI or page adaptations.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — components, data flow, and storage.
- [API contracts](docs/API_CONTRACT.md) — extension messages and backend endpoints.
- [Testing guide](docs/TESTING.md) — checks and manual acceptance steps.
- [Colour Vision Support](docs/COLOUR_VISION.md) — palettes, assessment assets, answer-key configuration, and verification.
- [Privacy & security](docs/SECURITY.md) — consent, safeguards, and known constraints.

## Compatibility

WEBBY works on ordinary HTTP(S) webpages. Browser-internal pages and the Chrome Web Store restrict extension access. Complex layouts, shadow DOM, embedded documents, and aggressively styled websites may need additional tuning.

Colour adaptation is selective: it does not recolour photographs or repair arbitrary image, SVG, or canvas charts. Reading Mode extracts a snapshot of an article; reopen it to pick up newly loaded content.

WEBBY is an accessibility aid, not a guarantee of complete accessibility compliance. Testing with real users and assistive technologies remains essential.

# WEBBY v1 — Shared Contracts and API

## Profile

```json
{
  "version": 1,
  "enabled": true,
  "fontScale": 1.1,
  "lineHeight": 1.6,
  "contrastMode": "normal",
  "darkMode": false,
  "reduceMotion": false,
  "focusAssist": true
}
```

`fontScale` 1.0–1.5; `lineHeight` 1.2–2.0; `contrastMode` one of `normal`, `high`; `darkMode` is a boolean (defaults to `false` for older saved profiles). Dark mode applies a reversible best-effort page-wide color inversion while counter-filtering common media elements. Some complex layouts may need site-specific tuning. Types are strictly checked. An optional site override is `{hostname, updatedAt, patch}` where `patch` is a subset of profile fields other than `version`.

## Internal extension runtime messages

Request types routed by `extension/background.js`:

| Type | Payload | Returns |
|---|---|---|
| `GET_PROFILE` | none | Profile |
| `SAVE_PROFILE` | `profile` | saved Profile |
| `GET_EFFECTIVE_PROFILE` | `hostname` | merged Profile |
| `SAVE_SITE_OVERRIDE` | `override` (empty `patch` resets the site) | saved override |
| `LIST_SITE_OVERRIDES` | none | overrides list |
| `CLEAR_ALL` | none | true |
| `GET_COLOUR_PREFERENCE` | none | validated colour preference (disabled default if absent/corrupt) |
| `SAVE_COLOUR_PREFERENCE` | `preference` | saved colour preference; refreshes websites |
| `CLEAR_COLOUR_PREFERENCE` | none | disabled default; removes only colour key and refreshes websites |
| `GET_COLOUR_CONTEXT` | none | `{preference,palette}` with extension-owned palette constants |
| `GET_ACCESSIBILITY_TWIN` | `hostname` | `{version:1,profile,colourPreference}` local combined preferences |

Colour preferences use a separate strict schema and `webbyColourPreference` storage key. Fields are `version:1`, boolean `enabled`, `paletteId` (`blue-amber`, `purple-teal`, `graphite`), `source` (`manual`, `activity`) and boolean `userConfirmed`. Enabling requires confirmation. Unknown fields are rejected. Existing profile/override schemas are unchanged; no clinical category, answers or scores are stored. See [Colour Vision Support](COLOUR_VISION.md).

Content-script tab messages (`chrome.tabs.sendMessage`): `GET_STATUS`, `GET_READING_TEXT`, `SET_FOCUS_READING`, `READING_TOOLS_UPDATED`, `PROFILE_UPDATED`.

All background responses follow `{ok:true,data:...}` or `{ok:false,error:"..."}`. Content tab responses include `ok` and additional fields as documented in the source.

## Reading endpoints

Each reading request requires explicit consent. Clicking Summarize/Read aloud in the popup opens a persistent reading-workspace tab with a fresh, one-time requested action. Reviewed drafts and completed summaries are cached in Chrome storage.session per source-tab ID and URL, and can be cleared; provider consent is never stored as a blanket persistent permission.

- `POST /api/summarize`: JSON `{ "text": "reviewed page text", "consent": true }`; 1?12,000 characters. Returns `{ "summary": "plain text", "provider": "groq" | "xai" | "openai" }`.
- `POST /api/speech`: same request shape; 1?1,500 characters per call. Returns binary `audio/wav`. The persistent reading-workspace tab splits longer text at word/sentence boundaries and plays requests sequentially.
- `GET /api/health`: includes `summaryProvider`, `summaryConfigured`, and `speechConfigured` alongside the existing fields. These describe configuration presence, not verified credentials, credits or live availability.

Both POST endpoints reject missing consent (403), non-JSON content (415), malformed/oversized text (400), disallowed browser origins (403), and bodies above 80 KiB (413). Missing provider configuration returns 503; provider failures return 502 or 429 with sanitized error messages. Responses are not cached. Keys, source URLs and provider error bodies are never returned.

The popup obtains `{ok:true,text,truncated}` through `GET_READING_TEXT`; flagged sensitive pages return `{ok:false,error}`. The preview is local until the user grants the shared reading consent and clicks that action. Closing the popup resets its consent checkbox but does not interrupt the already-authorized action running in the separate reading-workspace tab. Closing that tab stops its audio.

Provider references: [Groq chat](https://console.groq.com/docs/text-chat), [xAI chat](https://docs.x.ai/developers/rest-api-reference/inference/chat-completions), [Gnani REST speech](https://docs.gnani.ai/api/TTS/tts-inference).

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

## Structural page summary

```json
{
  "category": "article",
  "prefersDarkTheme": false,
  "elements": [
    {"id": "e1", "role": "main", "tag": "MAIN"},
    {"id": "e2", "role": "heading", "tag": "H1"},
    {"id": "e3", "role": "paragraph", "tag": "P"}
  ],
  "issues": [
    {"type": "small-text", "severity": "medium", "elementId": "e3"},
    {"type": "low-contrast", "severity": "medium", "elementId": "e3"}
  ]
}
```

Max 30 `elements`, max 30 `issues`. Opaque `e1`, `e2`, etc. exist only in the current tab. Categories: `article`, `landing`, `documentation`, `dashboard`, `other`. Issues: `small-text`, `tight-spacing`, `low-contrast`, `motion`, `weak-focus`, `clutter`. No page text, href, hostname, URL, form inputs or screenshot in the request.

## HTTP endpoint

```http
POST /api/analyze
Content-Type: application/json

{
  "version": 1,
  "profile": { ... profile from above ... },
  "page": { ... structural summary from above ... }
}
```

Sample response:

```json
{
  "version": 1,
  "source": "fallback",
  "actions": [
    {"type":"SET_TEXT_SCALE","factor":1.2},
    {"type":"BOOST_CONTRAST"},
    {"type":"HIGHLIGHT_MAIN","targetId":"e1"}
  ],
  "reasons": [
    "Small text was detected; increase text scale.",
    "Low-contrast text was detected; improve readable foreground colors."
  ]
}
```

### Allowlisted action types

| Type | Parameters | Semantics |
|---|---|---|
| `SET_TEXT_SCALE` | `factor`: 1.0–1.5, optional `targetId` | Increase text scale; v1 content script applies it page-wide |
| `SET_LINE_HEIGHT` | `ratio`: 1.2–2, optional `targetId` | Increase line spacing; v1 applies page-wide |
| `BOOST_CONTRAST` | optional `targetId` | Improve low-contrast text on known solid backgrounds; v1 applies page-wide |
| `REDUCE_MOTION` | none | Reduce animation/transition duration |
| `ENHANCE_FOCUS` | none | Strong keyboard focus-visible outline |
| `HIGHLIGHT_MAIN` | required main-role `targetId` | Outline main reading region |

The action allowlist validator requires referenced target IDs to exist in the provided page summary. It strips all unknown keys and discards invalid or out-of-range actions. The client performs a second validation.

**Action target behavior caution:** The v1 frontend uses page-wide adaptation for text scale/line height/contrast even when an optional `targetId` is supplied. Only `HIGHLIGHT_MAIN` currently uses element-specific targeting. Implementing per-element targeting is an improvement task (see LLM_HANDOFF.md).

## Internal extension runtime messages

Request types routed by `extension/background.js`:

| Type | Payload | Returns |
|---|---|---|
| `GET_PROFILE` | none | Profile |
| `SAVE_PROFILE` | `profile` | saved Profile |
| `GET_EFFECTIVE_PROFILE` | `hostname` | merged Profile |
| `SAVE_SITE_OVERRIDE` | `override` | saved override |
| `LIST_SITE_OVERRIDES` | none | overrides list |
| `GET_FEEDBACK_HISTORY` | none | feedback list |
| `GET_TWIN` | none | Twin summary |
| `RECORD_FEEDBACK` | `hostname`, `kind` | override, feedback event, effective profile |
| `GET_AI_CONSENT` | none | boolean |
| `SET_AI_CONSENT` | `consent: boolean` | boolean |
| `GET_ANALYSIS_HISTORY` | none | site-level analysis history |
| `ANALYZE_WITH_AI` | `tabId` | response with appliedCount |
| `CLEAR_ALL` | none | true |

Content-script tab messages (`chrome.tabs.sendMessage`): `GET_STATUS`, `GET_PAGE_SUMMARY`, `APPLY_AI_ACTIONS`, `PROFILE_UPDATED`.

All background responses follow `{ok:true,data:...}` or `{ok:false,error:"..."}`. Content tab responses include `ok` and additional fields as documented in the source.

## Feedback kinds

- `text-too-small`: +0.10 font scale, capped at 1.5
- `need-more-spacing`: +0.15 line height, capped at 2.0
- `increase-contrast`: sets high contrast on the site
- `reduce-motion`: enables reduced motion on the site
- `reset-this-site`: removes site override (a reset event stays in history)

No passive behavior tracking, recommendation inference or disability labels. This is a feedback-driven deterministic Twin.

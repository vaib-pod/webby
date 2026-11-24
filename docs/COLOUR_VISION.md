# Colour Vision Support

WEBBY includes a dedicated extension-local workspace, opened from **Accessibility controls → Colour Vision Support** in the popup or **Preferences → Colour Vision Support** in the dashboard. The popup's existing Quick Modes and collapsible sections remain intact.

## What is implemented

- Manual selection of seven colour-vision descriptions plus “I'm not sure”. The description suggests a starting palette; all three palettes remain available. The description itself is not stored.
- Blue & amber, Purple & teal, and Graphite & patterns, with text, underlined links, selectable example buttons, labelled/patterned charts and warnings to compare before applying.
- A manifest-driven, keyboard-operable plate activity with numeric answers, “I can't see a number”, Previous/Next, progress, editable review, results and retake. Blank or malformed responses block submission; unidentifiable responses are counted separately.
- A verified answer key for the ten supplied images: **12, 8, 29, 5, 3, 15, 6, 45, 73, 26**, in filename order. The user confirmed these visually and against their real answers on 2026-11-24. Image checksums bind the key to the unchanged supplied files. This is answer verification, not clinical validation.
- Local scoring with totals for scored/correct/incorrect/unable/unscored plates. No threshold or plate pattern assigns a diagnosis. All-unidentifiable results are inconclusive; any mismatch or unidentifiable response otherwise reports possible difficulty with the activity; matching all scored plates reports no clear difficulty identified by this activity.
- Settings to enable/disable, compare and change palettes, retake and clear only colour preferences. The Enable switch works before the first Apply, settings synchronize across tabs, and a paused global profile is reported explicitly.
- Reversible website adaptations: selective underlines for prose links (not search/navigation UI), contrast repair on known backgrounds, buttons, semantic alerts/status messages, selected-state outlines and focus indicators. Explicitly labelled opt-in HTML chart bars can receive colours/patterns. Text, events, roles and DOM structure are retained.

Link foreground colours (including nested search-result headings) remain controlled by the website so visited, unvisited and hover states stay distinct. Colour profiles underline prose links only; search results, navigation and search controls are left alone instead of receiving blanket link decorations or palette recolouring. Contrast and Calm Mode likewise avoid overriding link foregrounds; low-contrast links therefore keep the site's colours.

## Local storage and Accessibility Twin

`webbyColourPreference` is a separate, strictly validated Chrome local-storage object:

```json
{
  "version": 1,
  "enabled": true,
  "paletteId": "blue-amber",
  "source": "manual",
  "userConfirmed": true
}
```

`paletteId` is `blue-amber`, `purple-teal` or `graphite`; `source` is `manual` or `activity`. Enabling requires explicit user confirmation. Unknown fields, medical categories and arbitrary colours/styles are rejected. Reads fall back to disabled defaults if data is corrupt.

The checkout no longer contained the previous Twin engine or UI. `extension/shared/twin.js` now exposes a **read-only local integration boundary** that combines the existing effective website profile with the confirmed colour preference. `GET_ACCESSIBILITY_TWIN` returns this combined view. It does not infer needs, call AI, or recreate the removed Twin UI.

Existing `webbyProfile`, `webbyOverrides` and per-site reading-ruler keys remain separate. Colour support is global; per-site colour overrides are not implemented. Existing per-site enable/pause settings continue to govern whether adaptations run. “Clear colour preferences” removes only the colour key; the dashboard's existing “Delete all” removes it along with other WEBBY data.

Individual answers live only in the activity's in-memory Map. Scoring, leaving the activity or closing/navigating away clears them; retaking starts empty. Counts are shown in the current page only. No answers, diagnosis, result history or selected type are persisted. Requests from this feature are limited to extension-local JSON/PNG assets, and no backend/provider changes are needed.

## Adding or replacing images and configuring a key

1. Place an original PNG in `extension/assets/colourblind/`, for example `plate-11.png`. Do not recolour, crop or filter it. Confirm rights to distribute any added assets.
2. Add an entry to `extension/assets/colourblind/plates.json`. Entries determine question order and count; filenames are never interpreted as answers. Paths must stay under `assets/colourblind/`, use a simple filename, and end in `.png`. IDs and paths must be unique. The activity supports 1–100 entries.
3. Start an unknown plate as **unverified and unscored**:

```json
{
  "id": "plate-11",
  "path": "assets/colourblind/plate-11.png",
  "scored": false,
  "verification": "unverified",
  "expectedAnswers": [],
  "source": null,
  "sha256": "REPLACE_WITH_LOWERCASE_SHA256_OF_THE_IMAGE"
}
```

4. Calculate the checksum in PowerShell from the project root:

```powershell
(Get-FileHash -Algorithm SHA256 -LiteralPath extension/assets/colourblind/plate-11.png).Hash.ToLowerInvariant()
```

5. Establish the exact answer from a reliable key or explicitly confirmed visual verification. Record that source accurately. Then set `verification` to `verified`, `scored` to `true`, and `expectedAnswers` to one or more confirmed numeric strings, for example `["12"]`. Do not include alternative responses associated with a condition as “correct” unless they are actually accepted answers for the intended question. The scorer does not interpret diagnostic metadata.
6. **After replacing any image**, set it back to unverified/unscored, re-establish the answer, and recalculate its checksum. Never copy an old key just because the filename is unchanged.
7. Reload the extension and reopen the activity. Run `npm run check`, `npm test` and `npm run browser:check`. If deliberately changing the current ten-image key, update its regression expectations in `tests/colour.test.js` and `tools/colour-fixtures.js` after verifying the new answers. No assessment logic changes are needed for additional manifest entries.

Every scored entry requires a numeric answer array, verified status, nonempty source and matching image bytes. A malformed scored entry blocks loading. Missing/corrupt/changed scored images block submission. Unverified entries can be explored but never count toward scoring. At least one verified scored plate is required to submit. Results show how many questions were unscored.

## Testing in Chrome

1. Open `chrome://extensions`, enable Developer mode, and load the project's `extension` folder unpacked (or click Reload on WEBBY). Refresh existing website tabs so both content scripts load.
2. Open WEBBY → Accessibility controls → Colour Vision Support. Try manual selection, change the suggested palette, compare examples and choose Apply to Websites.
3. Visit an ordinary HTTP(S) page with links, buttons, readable text and an alert. Check underlines, contrast and preserved click/keyboard behaviour. Reload the page to confirm persistence.
4. In colour settings, disable support and confirm that colour-specific changes revert while existing text size, ruler, Dark Mode and site preferences remain. Re-enable, then test global pause. Clear colour preferences and verify other settings remain.
5. Start the activity. Navigate forward/back, use a blank/invalid answer and “I can't see a number”, review/edit answers, submit, preview alternatives and apply. Retake and confirm empty answers. Repeat with keyboard Tab/Shift+Tab, Enter/Space and radio arrow keys. The number input submits Next on Enter.
6. Confirm plates are wholly visible, with no WEBBY filter or cropping. Extension pages never receive the HTTP(S) content scripts, and the activity document has a defensive exclusion marker. External operating-system/browser filters must be managed by the user.
7. In extension-page DevTools, verify requests are local assets only and local storage contains the chosen palette/source but no answers or type. The local backend can remain stopped.

For cooperating HTML charts, a bar may opt in using `data-webby-chart-series="0"` (or `1`/`2`) and a meaningful `aria-label`. Bars must be empty HTML elements, with a visible adjacent label supplied by the site. WEBBY does not infer chart semantics or invent data labels.

## Verification and limits

Verification on 2026-11-24: `npm run verify` passed JavaScript syntax/Manifest V3 checks and **25/25 Node tests**. `npm run browser:check` passed every existing and new headless Chrome check across privacy, reader/speech, tools, presets, restored preferences, dashboard, colour workspace and colour adaptation fixtures. Desktop path/manual/activity screenshots and a 390px-wide manual-selection screenshot were inspected. `npm run extension:check` also passed 12 checks with the real unpacked MV3 extension installed in a disposable Chrome profile: settings save, updates to an already-open page, cross-tab synchronization, link/artwork preservation, Dark Mode, refresh persistence, disable/restore and global pause. This test uses no mocked extension APIs. The user's normal Chrome profile was not modified; a screen-reader audit was not performed.

`tests/colour.test.js` covers key/image integrity, exact scoring, blanks/invalid/unable answers, navigation, invalid keys/checksums, safe paths, manual choices, strict preferences, persistence and Twin integration without overwriting existing settings. `tools/extension-check.js` uses Chrome extension debugging to install the real extension into a temporary profile and verify the UI-to-storage-to-content-script path. Run it with `npm run extension:check` on a recent Chrome version (or set `WEBBY_BROWSER` to its path). `tools/colour-fixtures.js` exercises the real UI/controller/background/storage and content scripts in headless Chrome with mocked extension APIs; it also rejects external fetches. The browser suite retains the existing preset, reader, ruler, consent, summary, speech and dashboard checks.

These checks do not replace a manual unpacked-extension test on representative websites or a screen-reader/user study. Complex transparency, CSS, shadow DOM, cross-origin frames and arbitrary canvas/SVG/image charts are outside the adaptation's safe coverage. Work is bounded to 5,000 visited elements / 1,400 primary targets per pass, with debounced dynamic additions and class/semantic-state changes. Inline style-only changes and unusual CSS can require refreshing. Colour palettes apply in both light and Dark Mode; the existing Dark Mode filter transforms the chosen palette with the rest of the page. Ordinary form buttons, including those with icons, are supported; search forms/navigation remain excluded. Current-colour artwork inside adapted controls keeps its original colour. Excluded subtrees are skipped during the bounded traversal so large SVGs or navigation menus do not consume the whole scan budget. Photos/video/artwork are not recoloured by the new colour feature. Focus Reading Mode retains its existing independently styled reading surface.

Palette suggestions are exploratory and user-overridable, not a claim that one palette fits a condition. Contrast checking follows the [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), and underlines/labels/patterns follow [W3C use-of-colour guidance](https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html). Clinical colour-vision assessment belongs with an eye-care professional; see the [National Eye Institute's testing overview](https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/color-blindness/testing-color-vision-deficiency).

## Files

New: `extension/colour-vision.html`, `extension/colour-vision.css`, `extension/colour-vision.js`, `extension/colour-content.js`, `extension/shared/colour.js`, `extension/shared/twin.js`, `extension/assets/colourblind/plates.json`, `tests/colour.test.js`, `tools/colour-fixtures.js`, and this guide.

Modified: `extension/popup.html`, `extension/popup.js`, `extension/dashboard.html`, `extension/background.js`, `extension/shared/storage.js`, `extension/content.js`, `extension/content.css`, `extension/manifest.json`, `tools/browser-check.js`, `docs/API_CONTRACT.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/LLM_HANDOFF.md`, and `README.md`. The supplied PNGs and backend/provider/deployment files are unchanged.

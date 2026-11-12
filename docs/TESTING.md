# WEBBY v1 — QA and Demonstration Checklist

## A. Run automated tests

```bash
npm run verify
```

Expected outcome: JavaScript syntax + manifest validation OK, and all automated tests PASS. The Node test suite covers profile/schema validation, privacy field-stripping, action allowlisting, feedback learning and backend HTTP fallback/CORS behavior.

## B. Load in a real Chrome/Chromium browser (manual)

1. `chrome://extensions` → Developer mode → Load unpacked → select project `extension/`.
2. Check there is no red Manifest V3 error icon under WEBBY.
3. Pin WEBBY, open `http://127.0.0.1:4173` after running `npm run demo`.
4. Refresh the tab, then click the WEBBY popup. Confirm host is `127.0.0.1`, status is Active.
5. Open the dashboard. Confirm all navigation tabs and controls render.

## C. Visual adaptation and reversal

- [ ] Open demo page without extension or disable WEBBY; record original 11px paragraph text and floating “READING MATTERS” card.
- [ ] Enable WEBBY and set 125% text size; text grows but buttons stay usable.
- [ ] Set 1.75× line height; paragraph spacing increases.
- [ ] Enable Dark mode in the green popup; the page switches to a dark appearance and common media retain their original colors.
- [ ] Disable Dark mode; the original page appearance returns.
- [ ] Save Dark mode globally in dashboard Preferences; a new website uses the saved global setting.
- [ ] Enable High Contrast; low-contrast gray body copy darkens on plain backgrounds.
- [ ] Enable Reduce Motion; animation stops (transition duration near zero).
- [ ] Enable Focus Assist; Tab through links/buttons; visible gold focus ring appears.
- [ ] Toggle WEBBY off for this site and confirm original text/spacing/colors/motion return.
- [ ] Toggle WEBBY on again and confirm settings reapply.
- [ ] Test one normal external article page; check no serious layout breakages (site-specific compatibility varies).

## D. Preference persistence / Twin

- [ ] Save a 130% site font scale, then refresh; it stays 130%.
- [ ] Click `A+ Text too small`; scale increases 10 percentage points, capped at 150%.
- [ ] Click `More spacing`; line height increases 0.15, capped at 2.0.
- [ ] Visit dashboard → Accessibility Twin; verify site override and feedback event.
- [ ] Remove the site override or click Reset; global profile takes over.
- [ ] Edit global preferences; new websites follow those values without individual setup.
- [ ] Refresh web page after global update; settings are retained.

## E. Optional AI

- [ ] With AI consent off, click Analyze; WEBBY prompts for consent.
- [ ] With consent on but backend stopped, click Analyze; labeled fallback should apply.
- [ ] Start backend without key; backend /health reports `aiConfigured:false`; AI request returns fallback.
- [ ] Configure a valid key, restart backend; `aiConfigured:true`; request should return `source:ai` if provider succeeds.
- [ ] Backend rejects arbitrary scripted/CSS action types; see unit tests.
- [ ] Open a password/login page: Analyze must be blocked.
- [ ] Withdraw consent: further Analyze requests must be blocked.
- [ ] Confirm network requests contain only JSON page category, roles/tags, issue labels and user profile; no text/inputs/full URL.

## F. Robustness cases to investigate next

- [ ] Very long page with 1,400+ text nodes
- [ ] Dynamic single-page app with updates after initial load
- [ ] Shadow DOM, iframes and cross-origin iframes (currently unsupported)
- [ ] Dark-mode article, patterned background, gradients and SVG icons
- [ ] Zoom and OS high-contrast mode
- [ ] Browser restart/reinstall
- [ ] Keyboard navigation and screen-reader announcements in popup/dashboard
- [ ] Text scaling with CSS `rem`, `em`, and strongly nested DOM structures

## G. Browser test environment caveat

Automated tests in the delivered package are **Node-level**, not browser-level. The producing environment could run the demo server and verify HTTP response, but its managed headless Chromium blocked visiting `127.0.0.1` with an organization-policy error. This did not demonstrate a defect in the extension; it means a real browser end-to-end acceptance test remains outstanding. Do not claim full browser QA coverage yet.

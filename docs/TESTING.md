# WEBBY v1 — QA and Demonstration Checklist

## A. Run automated tests

```bash
npm run verify
```

Expected outcome: JavaScript syntax + manifest validation OK, and all automated tests PASS. The Node test suite covers profile/schema validation, reading privacy, site preference persistence and backend HTTP/CORS behavior.

## B. Load in a real Chrome/Chromium browser (manual)

1. `chrome://extensions` → Developer mode → Load unpacked → select project `extension/`.
2. Check there is no red Manifest V3 error icon under WEBBY.
3. Pin WEBBY, open `http://127.0.0.1:4173` after running `npm run demo`.
4. Refresh the tab, then click the WEBBY popup. Confirm host is `127.0.0.1`, status is Active.
5. Open the dashboard. Confirm all navigation tabs and controls render.

## C. Visual adaptation and reversal

- [ ] Open demo page without extension or disable WEBBY; record original 11px paragraph text and floating “READING MATTERS” card.
- [ ] Set 125% text size and save for this site; text grows but buttons stay usable.
- [ ] Set 1.75× line height; paragraph spacing increases.
- [ ] Enable Dark mode in the green popup; the page switches to a dark appearance and common media retain their original colors.
- [ ] Disable Dark mode; the original page appearance returns.
- [ ] Save Dark mode globally in dashboard Preferences; a new website uses the saved global setting.
- [ ] Enable High Contrast; low-contrast gray body copy darkens on plain backgrounds.
- [ ] Enable Reduce Motion; animation stops (transition duration near zero).
- [ ] Enable Focus Assist; Tab through links/buttons; visible gold focus ring appears.
- [ ] Pause WEBBY using dashboard Preferences (clear any site override first) and confirm original text/spacing/colors/motion return.
- [ ] Enable WEBBY in dashboard Preferences again and confirm settings reapply.
- [ ] Test one normal external article page; check no serious layout breakages (site-specific compatibility varies).

## D. Preference persistence

- [ ] Save a 130% site font scale, then refresh; it stays 130%.
- [ ] Change text size and click Save for this site.
- [ ] Adjust line height and save; the chosen spacing persists after refresh.
- [ ] Visit dashboard Preferences; verify the site override appears under Website customizations.
- [ ] Remove the site override or click Reset; global profile takes over.
- [ ] Edit global preferences; new websites follow those values without individual setup.
- [ ] Refresh web page after global update; settings are retained.

## F. Robustness cases to investigate next

- [ ] Very long page with 1,400+ text nodes
- [ ] Dynamic single-page app with updates after initial load
- [ ] Shadow DOM, iframes and cross-origin iframes (currently unsupported)
- [ ] Dark-mode article, patterned background, gradients and SVG icons
- [ ] Zoom and OS high-contrast mode
- [ ] Browser restart/reinstall
- [ ] Keyboard navigation and screen-reader announcements in popup/dashboard
- [ ] Text scaling with CSS `rem`, `em`, and strongly nested DOM structures

## G. Reading integration verification

- `npm run verify`: syntax/manifest checks and network-free Node tests, including provider routing, credential isolation, consent enforcement, validation, HTTP error handling, WAV responses and Unicode-safe chunking.
- `npm run browser:check`: checks in real headless Chrome with mocked extension/provider APIs. Covers visible-text extraction; exclusion of forms, editors, hidden and sensitive content; no upload on preview; shared summary/speech consent; summary rendering; cancellation; stale-summary invalidation; and navigation guards. Set `WEBBY_BROWSER` to another Chromium executable if Chrome is not in the default Windows path. No real keys or provider requests are used.
- `npm run providers:check`: two live requests with fixed sample text (may consume provider credits). Live Groq summaries and Gnani speech have been verified.

The headless checks use extension API stubs. They do not replace a loaded-extension click-through or human listening test:

- [ ] Reload the extension, refresh a normal webpage and open its popup.
- [ ] Load preview text and review it; no text upload should occur yet.
- [ ] Enable the shared reading permission, generate a summary with a configured provider, then listen without checking another box.
- [ ] Read a long preview, pause/resume, stop and close the popup during playback.
- [ ] Confirm the next popup starts with the shared reading permission unchecked.
- [ ] Confirm provider failures display useful messages without leaking keys or fabricated results.


## H. Presets, ruler and Focus Reading Mode

Verified by `npm run check`, `npm test` (25 passing), and `npm run browser:check` (61 passing). The Chrome runner uses a DevTools pipe with real animation frames, rather than virtual time, so ruler movement is actually exercised. Browser fixtures use mocked Chrome APIs; the preset fixture runs the real background router, popup and storage modules. No external provider requests are made.

Coverage includes exact preset values and selection, site persistence, manual Custom state, Reset, independent ruler storage, restoration in a fresh document, popup reopening, mouse/focus tracking, scrolling, dark-mode coordinates, cleanup, reader sanitization, links, keyboard wrap, Escape/Exit, original DOM/focus/scroll restoration, reader typography updates, sensitive-page rejection and missing/hidden article handling. Existing summary and speech consent/playback tests still pass.

Manual acceptance in a loaded Chrome extension remains recommended:

1. Reload WEBBY in `chrome://extensions`; refresh the demo or an ordinary webpage. The three new features do not need `npm run server`.
2. Click each preset. Verify the six requested settings, selected card, success message and immediate page changes. Refresh and reopen the popup to verify persistence. Change a slider, confirm Custom, save, and test Reset. Visit another hostname to verify isolation.
3. Turn Reading Ruler on. Move the mouse, scroll, Tab through links, click and select text. Test with dark mode enabled. Refresh and check the ruler returns. Turn it off and verify the overlay disappears. Reopen the popup to confirm the displayed toggle matches the tab.
4. Open an article with headings, lists and links. Enter Focus Reading Mode, use links and keyboard navigation, then press Escape. Re-enter and use the visible Exit button. Check original controls/event handlers still work and the page returns to its original scroll/focus position.
5. Try a short empty page or a password/payment page: the reader should show an explanation without creating a reader overlay.
6. Recheck manual save, summary preview and read-aloud. Focus Reading Mode does not grant the shared reading permission.

A loaded-extension end-to-end test and a human screen-reader review are not represented by the mocked browser fixtures. Ruler and reader behavior on third-party sites with unusual DOM/CSS still needs practical testing.

## I. Popup persistence and search-link regression (2026-11-24)

- `npm run verify` checks normal features and the new functional colour-adaptation test using simulated prose, search, nav, and form controls. The browser mock now also covers the persistent reading-tab handoff, session restoration and workspace summary flow.
- Popup **Summarize** with consent opens an extension-owned reading workspace tab. Closing the popup must not stop that tab's summary or audio; reopening WEBBY on the original tab must show the finished summary and reviewed text with consent unchecked.
- Click **Clear saved**; check the draft and summary disappear. Changing the source tab URL or closing it must also invalidate/clear the session cache.
- On a search-results page, turn colour support on. Search form buttons, nav links and result titles should keep their original styles; prose links inside an article may be underlined. Turn it off and verify original styling returns.
- The colour-vision assessment uses ten supplied PNGs; see the README for a development-only answer key and test procedure.

Note: real extension APIs and actual Chrome tab lifecycle still need a manual unpacked-extension acceptance pass. The headless runner uses mocked extension APIs and is not a substitute for that test.

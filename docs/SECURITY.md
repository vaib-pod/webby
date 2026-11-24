# WEBBY v1 — Privacy & Security Notes

## Implemented safeguards

1. **Shared reading permission:** Summary and speech use one checkbox and require a manual action. The permission resets when the popup closes.
2. **No provider key inside the extension:** Only the local backend receives provider keys from its environment or ignored `backend/.env` file.
4. **Sensitive page guard:** When password/payment-related inputs are present, or pathname suggests login, checkout or billing, reading-text extraction and Focus Reading Mode are rejected.
5. **Request validation:** The backend requires consent and enforces text type, length, origin and content-type restrictions.
6. **No arbitrary generated code:** Summaries are displayed as text; speech responses must contain valid WAV audio.
7. **Local-first storage:** Profile and site overrides reside on the current browser profile in `chrome.storage.local`. Optional sync/authentication is absent.
8. **Reversible style modifications:** Original inline properties are restored before re-applying or disabling WEBBY. Controls/editors are not rewritten.
9. **Loopback-only backend:** Binds to `127.0.0.1`, not `0.0.0.0`. Browser CORS allows `chrome-extension://` origins rather than arbitrary webpages.
10. **Output encoding:** Popup and dashboard use `textContent` rather than HTML injection for user, website and AI-originated data.

## Limitations and risks

Colour activity answers are processed in memory and discarded after scoring or leaving the activity. No type, diagnosis, answers or result history is saved or sent to providers. Only an explicitly applied palette, enable state and manual/activity provenance enter the separate validated local preference. Local asset paths are constrained; scored image bytes must match the manifest checksum and a confirmed numeric key. The activity is non-diagnostic, and extension content scripts do not run on its extension-origin page. See [Colour Vision Support](COLOUR_VISION.md).

- Chrome extension browser permission covers all http(s) pages, required for universal accessibility. Users should review and trust installed code; the content script can inspect styles and DOM in the tab.
- The example backend lacks authentication, anti-CSRF tokens and request rate limiting. CORS is not authentication against native/local clients. **Do not expose the backend on public networks or deploy it as-is.**
- Heuristic detection of sensitive pages is conservative but cannot identify every private website; the safest choice is not to share sensitive preview text.
- Automatic contrast correction may be imperfect where CSS uses gradients, images, opacity or nested backgrounds. Accessibility testing with real users and assistive technology is still necessary.
- Model provider and API behavior can change. Test the specific model before calling the product “AI-powered” in a live demo.
- Full audit, automated keyboard navigation checks, screen-reader testing and cloud threat modeling are not included.

## Security-sensitive extension points

**Do not modify** `extension/shared/contracts.js` validator to accept arbitrary CSS, JavaScript, HTML, URL or selector strings. If future requirements demand custom AI transformations, design a constrained DSL with static compile-time and runtime checks; keep remote responses non-executable.

**Reading consent:** `/api/summarize` and `/api/speech` accept text only with `consent:true`. The popup and persistent reading tab use an explicit consent checkbox. Consent in the popup resets when it closes, and each auto-launched tab consumes only a fresh one-time user-requested action. Loading a preview is local; only button clicks upload reviewed text. Extraction excludes forms, editors, hidden content and navigation, with a 12,000-character cap. Speech requests are limited to 1,500 characters and sent sequentially. Reviewed text drafts and finished summaries are temporarily retained in Chrome storage.session for the original tab and exact URL, not in cloud/local persistent storage. Users can clear them; they are removed when the source tab closes and on browser restart. Speech audio is not retained or logged. Providers may retain submitted content under their own policies. Stopping aborts browser requests but cannot recall text already submitted.

**Privacy limits:** Sensitive-page detection is heuristic. Users must review previews; visible personal information in ordinary paragraphs cannot reliably be detected. Native/local clients can assert consent themselves. Do not expand text collection without updating consent and privacy tests.

**Do not store** API keys in `chrome.storage` or in the source ZIP.

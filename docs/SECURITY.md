# WEBBY v1 — Privacy & Security Notes

## Implemented safeguards

1. **Consent-first AI:** A user must toggle AI consent, then explicitly click Analyze for each analysis request. No passive analysis uploads.
2. **No provider key inside the extension:** Only the local backend receives `OPENAI_API_KEY` from its environment.
3. **Sanitized structural summary:** The payload includes categories, tag names, roles, opaque IDs and issue type/severity. No raw HTML, real page text, URL, title, form entries, passwords, screenshots or browsing history.
4. **Sensitive page guard:** When password/payment-related inputs are present, or pathname suggests login, checkout or billing, analysis is rejected.
5. **Double validation:** The backend validates request/response; the Chrome background validates response; content script validates action types and ranges again.
6. **No arbitrary generated code:** Models can return only a small fixed set of finite actions and numeric parameters. No code, selectors or injected HTML.
7. **Local-first storage:** Profile, overrides and feedback reside on the current browser profile in `chrome.storage.local`. Optional sync/authentication is absent.
8. **Reversible style modifications:** Original inline properties are restored before re-applying or disabling WEBBY. Controls/editors are not rewritten.
9. **Loopback-only backend:** Binds to `127.0.0.1`, not `0.0.0.0`. Browser CORS allows `chrome-extension://` origins rather than arbitrary webpages.
10. **Output encoding:** Popup and dashboard use `textContent` rather than HTML injection for user, website and AI-originated data.

## Limitations and risks

- Chrome extension browser permission covers all http(s) pages, required for universal accessibility. Users should review and trust installed code; the content script can inspect styles and DOM in the tab.
- A structural summary may reveal that a page has certain issue types, even without its text; consent should be informed and withdrawable.
- The example backend lacks authentication, anti-CSRF tokens and request rate limiting. CORS is not authentication against native/local clients. **Do not expose the backend on public networks or deploy it as-is.**
- Heuristic detection of sensitive pages is conservative but cannot identify every private website; the safest choice is not to click Analyze on sensitive content.
- Automatic contrast correction may be imperfect where CSS uses gradients, images, opacity or nested backgrounds. Accessibility testing with real users and assistive technology is still necessary.
- Model provider and API behavior can change. Test the specific model before calling the product “AI-powered” in a live demo.
- Full audit, automated keyboard navigation checks, screen-reader testing and cloud threat modeling are not included.

## Security-sensitive extension points

**Do not modify** `extension/shared/contracts.js` validator to accept arbitrary CSS, JavaScript, HTML, URL or selector strings. If future requirements demand custom AI transformations, design a constrained DSL with static compile-time and runtime checks; keep remote responses non-executable.

**Do not add** page text collection without a new consent design and new privacy testing. The current default minimization is a conscious product constraint.

**Do not store** API keys in `chrome.storage` or in the source ZIP.

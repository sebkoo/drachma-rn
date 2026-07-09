# ADR 0002 — Where the boundary between native and WebView sits

**Status:** Accepted · **Date:** 2026-07-08

## Context

A real mobile app is rarely all-native or all-web. The interesting question is
where the seam goes, and why. Upstart's own mobile team published their answer
("Building a Mobile App: Zero to One", Upstart Tech, Nov 2023): the app is
deliberately hybrid, blending webviews and native "as seamlessly as possible,"
with two heuristics —

- **Native wins on interactivity.** "Native animation will be snappier and
  smoother than those inside a webview." Anything the user pokes at directly
  should be native.
- **WebView wins on content.** When content is complex, changes frequently, and
  the org can't afford to maintain the same logic in multiple places, a webview
  is the right call.

Drachma should demonstrate that it understands this boundary, not just pick a
side — because the team's actual mandate is migrating a web-first experience
into native, one surface at a time.

## Decision

Draw the line by those same two heuristics:

| Surface | Native or Web | Why |
| --- | --- | --- |
| Converter (typing, pair swap, live result) | **Native** | Pure interactivity; every tap should feel instant. |
| Rate alerts (form, optimistic list) | **Native** | Interactive + offline writes; needs the native queue. |
| "About these rates" explainer | **WebView** | Content-heavy, changes when data sources / policy change (more often than the app ships), barely interactive. |

The explainer renders **bundled HTML** — no fetch — so the product's
offline-honesty rule survives into the web half. The two halves talk over
exactly **one bridge**: a pair tapped in the web content `postMessage`s a
`{type:'convert'}` intent; the native screen parses it and drives the same
converter seam a deep link uses (`applyConvert`). Web content in, native
navigation out.

**The bridge is a trust boundary, so it is treated as one.** `parseBridgeMessage`
validates the payload exactly as strictly as the deep-link parser — 3-letter
codes only — because an unvalidated `from`/`to` would ride through into an
outbound request path and a cache key. And the WebView is locked to its own
content: `onShouldStartLoadWithRequest` allows only the initial `about:` load
and refuses every other navigation, so a stray or compromised link can't launch
the system browser to an external URL. Neither control is needed by the current
static HTML; both exist because a native/web bridge must never assume the web
side is honest.

## Consequences

- The hybrid boundary is a working demo, not a claim: `AboutRatesScreen` +
  `ratesExplainer` + the `parseBridgeMessage` tests show the seam end to end.
- Migration path is explicit: when a web surface grows interactive enough to
  fail the "native wins on interactivity" test, it moves native — and the
  bridge contract (`postMessage` intents) is the stable interface that makes
  that move incremental rather than a rewrite.
- Cost / honest gaps: bundled HTML means the explainer copy ships with the app
  (a real deployment would load it from a CDN for high-frequency updates — the
  exact reason the blog gives for webviews; noted, not built). And there is no
  auth/session handoff into the webview here, because this app has no auth;
  simulating a token bridge would be cosplay, so it is left out on purpose.

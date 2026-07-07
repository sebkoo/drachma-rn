# Drachma RN

The **React Native client** for the [Drachma](https://github.com/sebkoo/drachma)
rates platform — the same product, rebuilt as a cross-platform app in
TypeScript. Built in the open with Claude Code, like everything else in the
Drachma family.

## Why this exists

Drachma is one platform with several surfaces: a native SwiftUI iOS app,
WidgetKit widgets, an MCP server for AI agents, and an OAuth 2.1-protected
REST API. This repo adds the next surface: a React Native app targeting iOS
**and Android** from one codebase.

It also exists to answer a question with code instead of opinions: having
built the same product natively first, what does React Native make easier,
and what does it make harder? (Ongoing notes in the commit history.)

## Rules carried over from the platform

- **Keyless data** — ECB reference rates via Frankfurter; community rates
  (currency-api) for the long tail of currencies.
- **Provenance on screen** — every rate says where it came from:
  `ECB reference · 2026-07-06` vs `Community (indicative) · 2026-07-06`.
  Indicative data is never dressed up as official.
- **No accounts, no tracking.**

## Stack

React Native 0.86 (New Architecture) · TypeScript · Jest (12 tests: conversion
math, provider routing, failure paths, and a full-app render asserting the
provenance label) · GitHub Actions CI.

## Run it

```sh
npm install
npm test                 # jest
npm run ios              # requires: cd ios && bundle install && bundle exec pod install
npm run android
```

## Roadmap

- [x] Typed rates client with provider routing + tests
- [x] Converter screen (dark mode, provenance label)
- [ ] CI: Android debug build on every push
- [ ] CI: iOS simulator build on every push
- [ ] Custom native module in Swift (bridging the platform's native strengths)
- [ ] 7-day history chart
- [ ] Deep linking (`drachma://convert?from=USD&to=KRW`)

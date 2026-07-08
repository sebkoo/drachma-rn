# ADR 0001 — Migrate CurrencyFormatter to a codegen TurboModule

**Status:** Accepted · **Date:** 2026-07-08

## Context

The currency formatter started as a legacy `RCT_EXTERN_MODULE` reached through
the New Architecture's interop layer. It worked, but two things were true that
a reviewer would rightly poke at:

- It was not codegen-backed, so there was no typed spec to point to when asked
  "show me the TurboModule contract".
- It only existed on iOS. Android silently fell back to a JS formatter that
  leans on Hermes's partial `Intl`, so `KRW`/`JPY`/`VND` could format wrong on
  the platform this codebase promises to expand into.

## Decision

Add a codegen spec (`src/native/NativeCurrencyFormatter.ts`) and `codegenConfig`,
and make both platforms real TurboModules against it:

- **iOS** — an Objective-C++ module conforms to the generated
  `NativeCurrencyFormatterSpec` and returns the `…SpecJSI` from `getTurboModule`.
  The formatting itself stays in Swift (`CurrencyFormatting`), which the module
  forwards to via a minimal ObjC forward declaration — not the target umbrella
  `-Swift.h` (see below).
- **Android** — a Kotlin module extends the generated `NativeCurrencyFormatterSpec`
  and is registered through a `TurboReactPackage`, using `java.util.Currency`
  for the same locale correctness Foundation gives iOS.
- **JS** — resolves the module via `TurboModuleRegistry.get` (nullable), so Jest
  and any not-yet-implemented platform fall back instead of throwing.

## Why the iOS boundary is Objective-C++, not Swift

`getTurboModule` returns `std::shared_ptr<facebook::react::TurboModule>` — a C++
type Swift cannot express. A pure-Swift TurboModule would therefore mean either
dropping to the interop layer (what we just left) or hand-writing C++ interop
Swift doesn't support. So the module boundary is ObjC++ and the domain logic
stays in Swift: each language does the job it is actually good at. This is the
honest answer to "why isn't the whole thing in Swift?" — not a limitation I
missed, a boundary I placed on purpose.

## Why a forward declaration, not `#import "DrachmaRN-Swift.h"`

The obvious way to call the Swift helper is to import the target's generated
Swift header. But that umbrella header re-declares *every* `@objc` Swift class
in the app — including `AppDelegate`'s `ReactNativeDelegate`, whose React
superclass isn't visible from a plain module `.mm` — so importing it fails to
compile. Declaring just the one class method we call keeps the module
self-contained; the Swift symbol links from the same target at build time.
Found and fixed by building locally before pushing, not by watching CI go red.

## Consequences

- The claim "codegen TurboModule, both platforms" is now true with no asterisk;
  the spec is a file, not a story.
- Android gains real locale-correct formatting — the fallback is now a genuine
  fallback, not the only implementation.
- Cost: the iOS module spans three files (Swift helper, ObjC++ module, TS spec)
  and the project carries `codegenConfig`. That is more surface than the old
  one-file `RCT_EXTERN_MODULE`, justified by the two-platform correctness and
  the typed contract.
- The JS fallback stays deliberately, because "optional native module with a
  graceful degrade" is the right shape for a formatter — not every platform-run
  needs to hard-require it (Jest being the obvious case).

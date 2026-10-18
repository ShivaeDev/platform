---
"@shivaedev/effect-react": minor
---

### Added

- `captureReactWarnings` in `client/testing.ts` acquires a scoped, silent capture for story kits. Its `ReactWarnings` handle reads console calls and unexpected caught React errors as a `ReactWarningsReadout`, excludes declared caught errors, and restores `console.error` on scope closure, including failed stories. `expectNoReactWarnings` uses the same capture mechanism.

---
"@shivaedev/effect-react": minor
---

### Added

- Pass React's `RootOptions` to test `render(node, options)`, including `onCaughtError`, `onUncaughtError` and `onRecoverableError`.
- Declare expected boundary errors with `expectNoReactWarnings().expectCaughtError(predicate)`, using its returned `onCaughtError` handler in `render`. Unexpected caught errors, console errors, React warnings and missing expected errors still fail the guard.

---
"@shivaedev/test-story": minor
---

### Added

- DOM `find` and `findText` keep waiting while the screen shows a visible loading status, `aria-busy="true"`, `Loading…` text or an open dialog. The normal 3-second budget extends to at most 10 seconds, configurable with `loadingTimeoutMs`. Explicit per-call timeouts remain hard deadlines; an idle screen keeps the usual timeout and target diagnostics.

---
"@shivaedev/work-fleet": minor
---

### Changed

- Supervision uses filesystem events and a slow safety check of each child's loaded modules. Unimported dependency changes leave children running, and bursts of loaded-code changes coalesce into one restart.

### Breaking

- `codeReader(boardDir)` returns an Effect with the installed entrypoints instead of a synchronous polling function. Replace `codeReader(boardDir)()` with `yield* codeReader(boardDir)`. `RunningCode` now includes the installed `manifest` path; callers constructing it must provide that package's `package.json` path so supervision can follow package replacements.

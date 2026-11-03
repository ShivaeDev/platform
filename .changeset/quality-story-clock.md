---
"@shivaedev/quality": minor
---

### Breaking

- `runQuality` from `testing/adapters/cli.ts` returns an Effect that keeps the caller's clock and lifecycle. Replace `await runQuality(...)` and `Effect.promise(() => runQuality(...))` with `yield* runQuality(...)` inside an Effect. Quality story kits use the controlled test clock.

### Changed

- Quality fixtures use their own process lock for in-process commands, executable commands and git-hook checks.

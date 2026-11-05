---
"@shivaedev/test-story": minor
"@shivaedev/quality": minor
"@shivaedev/skills": patch
"@shivaedev/create-app": patch
"@shivaedev/react": minor
"@shivaedev/test": patch
---

### Breaking

- `@shivaedev/test-story`: Story kits and per-story options no longer accept `clock: "live"`. Remove that option to use the controlled clock, or supply a UTC `DateTime` to pin its start. Advance elapsed time through kit verbs using `TestClock.adjust` or `passes`, drive any outside engine's clock too, and await the engine's completion signal. Type shared story options with `StoryTestOptions` from `@shivaedev/test-story/server/storyOptions.ts`.
- `@shivaedev/quality`: `tests/wait-on-events` also reports wall-clock reads and real timer APIs in stories and reachable kits, and accepts no config exceptions. Replace real waits with controlled clock verbs and engine signals; deadlines that only fail an unfinished wait remain allowed.

### Added

- `@shivaedev/react`: `SessionBoundary` accepts a native atom `runtime` for its session-recheck retry loop. Supply a runtime carrying the story Clock to drive recovery backoff without real waits.

### Fixed

- `@shivaedev/create-app`: Starter and generated application stories use controlled clocks.
- `@shivaedev/react`: Story examples use the controlled clock.
- `@shivaedev/test`: Documentation directs stories to controlled time and engine signals.
- `@shivaedev/skills`: Story-testing guidance points to the controlled clock and states which real-time waits are forbidden.

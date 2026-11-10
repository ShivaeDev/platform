---
"@shivaedev/contract": minor
"@shivaedev/skills": patch
"@shivaedev/test-story": minor
---

### Added

- `@shivaedev/test-story`: The screen driver's `withLiveAnswer(answers, action, { timeoutMs }?)` runs a screen action and returns once a named live query has answered after it, so a screen story can read a result that reaches the screen as a server push after the command has settled. When no answer arrives, the verb fails with `SignalNotReceived`, which names the query.
- `@shivaedev/contract`: `liveAnswers(registry, name, query)` from `liveAnswers.ts` counts a bound query's settled answers, pushed or unchanged, for the screen driver's `withLiveAnswer`.

### Changed

- `@shivaedev/skills`: The story-testing skill tells kits to wrap a screen action in `withLiveAnswer` when its result reaches the screen only through a live query.

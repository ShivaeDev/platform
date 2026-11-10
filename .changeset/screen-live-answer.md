---
"@shivaedev/contract": minor
"@shivaedev/skills": patch
"@shivaedev/test-story": minor
---

### Added

- `@shivaedev/test-story`: The screen driver's `withLiveAnswer(answers, action, { timeoutMs }?)` runs an action and returns once a named live query has answered after it, so a screen story can read a result that reaches the screen as a server push after the command has settled, or after another viewer's write. When no answer arrives, the verb fails with `SignalNotReceived`, which names the query.
- `@shivaedev/contract`: `liveAnswers(registry, name, query)` from `liveAnswers.ts` counts a bound query's settled answers, pushed or unchanged, for the screen driver's `withLiveAnswer`.

### Changed

- `@shivaedev/skills`: The story-testing skill tells kits to wrap an action in `withLiveAnswer` when its result reaches the screen only through a live query, and no longer recommends `nextLiveHint()`.

### Breaking

- `@shivaedev/test-story`: The screen driver no longer has `nextLiveHint()`, and `MissingClientActivity` is gone. Replace a fork of `driver.nextLiveHint()` before an action and a join after it with `driver.withLiveAnswer(liveAnswers(view.registry, "the notes list", client.api.list.query()), action)`, naming the query that shows the change. `ScreenDriver` takes one type parameter: change `ScreenDriver<E, THintError>` to `ScreenDriver<E>`. `ScreenSignalState` no longer has `hints`.
- `@shivaedev/contract`: `activityScreenSignal` no longer reports `hints`; wait for a live change with `liveAnswers` and the screen driver's `withLiveAnswer`.

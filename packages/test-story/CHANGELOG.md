# Changelog

## 0.1.0 - 2026-10-06

### Added

- `@shivaedev/test-story/storyKit.ts` exports `storyKit<State>()(...stages)`, which returns `trait`, `traits` and `seed` for one kind of state. A trait is a story line and an `apply`, tagged with one of the kit's stages; the stages are part of the kit's type. `seed(state, given, { after })` applies the traits stage by stage, runs each stage's `after` hook once that stage is applied, and returns the story log. A trait whose `apply` throws refuses the setup: `seed` throws `trait "<line>" refused: <cause>` with the thrown value as its `cause`.
- `@shivaedev/test-story/storyLog.ts` exports `storyLog()`, the story log that `seed` starts with one line per trait and the application's verbs and steps tell the rest. When the test fails, the story so far is added to its first error. `storyLog({ printOnFailure: false })` makes a log that adds nothing, for `seed`'s `log` option.
- `@shivaedev/test-story/settle.ts` exports `settle(log, { failed, settled, step, cap, diagnose, report })`, which steps the domain until it settles and returns the report, throws the failure the domain names, and after `cap` steps throws the diagnosis with the last 10 lines of the story.
- `@shivaedev/test-story/effect/storyKit.ts` and `@shivaedev/test-story/effect/settle.ts` export `effectStoryKit<Target, R>()(...stages)` and `settleEffect`, which take Effects instead of functions. A refused trait and a reached cap die instead of failing, and an interrupted trait stays interrupted. `effect` is an optional peer that only these modules import.

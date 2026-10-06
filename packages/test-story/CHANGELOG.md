# Changelog

## 0.1.0 - 2026-10-06

### Added

- `@shivaedev/test-story/storyKit.ts` exports `storyKit(definition)`, one story kit per engine. The definition names the engine, says how to `create` a fresh one, the `stages` traits are applied in with an optional `after` hook per stage, the optional `run` hooks (`step`, `maxSteps`, `failed`, `diagnose`), an optional `inspect` and the `verbs` a test acts through; every type is inferred from it. The kit returns `trait`, `traits` and `start(...traits)`, which starts a story on a fresh engine and returns the verbs with the `story`: its `engine`, `lines`, `tell(line)` and `runUntil(condition, { maxSteps })`.
- A trait that throws refuses the setup: `start` throws `the trait "<line>" refused to set up the <engine>: <cause>` with a `help:` line, and the thrown value as the error's `cause`.
- `story.runUntil` steps the engine until the condition holds, throws what `run.failed` reports even when the condition also holds, and after `maxSteps` steps throws with `run.diagnose`.
- A test that started a story and failed prints the story under its first error: every line in order with the spec line behind it, a mark where it stopped or on the trait that refused, the engine's state from `inspect` as one line of JSON (written to `node_modules/.cache/test-story/` when longer than 2,000 characters), and the command that reruns the test. A thrown string, plain object or tagged error prints by its content. A story started outside a test prints nothing.
- `@shivaedev/test-story/effect/storyKit.ts` exports `effectStoryKit(definition)` for Effect engines. Hooks and traits may be generator functions, which the kit runs, or plain functions. `start` is an Effect that keeps the typed failures of `create` and the `after` hooks and needs their services and those of the traits it starts with; a trait that fails, dies or throws makes it die with the refusal, and an interrupted trait stays interrupted. `runUntil` keeps the typed failures of its hooks and condition and dies with what `failed` reports or when the step budget runs out. `effect` is an optional peer that only this module imports.

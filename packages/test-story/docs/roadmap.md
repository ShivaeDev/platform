# Roadmap

## Built

- [x] `storyKit(definition)`: one Effect kit per engine, with every type and the services its layer provides inferred from its hooks. Plain engines plug in with plain functions.
- [x] Traits seeded stage by stage, with a hook after each stage, and refusal of an impossible setup.
- [x] The kit's own `it`, built on `@shivaedev/effect-test`, which hands the body the verbs and the story and tags every test with the kit's genre, declared in the Vitest config with `genreTag(name)`.
- [x] `story.runUntil(condition)`: steps the engine until the condition holds, stops on what `run.failed` reports, and stops after a step budget with a diagnosis, keeping every hook's typed failure in its error channel.
- [x] A failed test prints its story with the spec line behind each line, where it stopped, and the engine's state, inline or in a file under `node_modules/.cache/test-story/`.

## Next

- [ ] Move a first application's hand-written story DSL onto the kit and let what it needs decide the next hook.

## Open questions

- A long story prints in full. Should a story of thousands of lines print its traits and its last lines, and write the rest to a file the way a large engine state is written?
- `inspect` runs synchronously when the test has failed. An engine whose state lives behind an Effect service cannot be read then. Is that worth an Effect inspect, captured when the failure happens?

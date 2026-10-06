# Roadmap

## Built

- [x] `storyKit(definition)` and `effectStoryKit(definition)`: one definition per engine, with every type inferred from its hooks.
- [x] Traits seeded stage by stage, with a hook after each stage, and refusal of an impossible setup.
- [x] `story.runUntil(condition)`: steps the engine until the condition holds, stops on what `run.failed` reports, and stops after a step budget with a diagnosis.
- [x] A failed test prints its story with the spec line behind each line, where it stopped, and the engine's state, inline or in a file under `node_modules/.cache/test-story/`.
- [x] The Effect flavour: generator hooks, typed failures of create, after hooks and steps in the error channel, services inferred from the traits a story starts with.

## Next

- [ ] Move a first application's hand-written story DSL onto the kit and let what it needs decide the next hook.

## Open questions

- A long story prints in full. Should a story of thousands of lines print its traits and its last lines, and write the rest to a file the way a large engine state is written?
- `inspect` runs synchronously when the test has failed. An engine whose state lives behind an Effect service cannot be read then. Is that worth an Effect-flavoured inspect, captured when the failure happens?
- Large state is written under `node_modules/.cache/test-story/` relative to the working directory. Should the place be configurable?
- `README.md` and `CHANGELOG.md` are published; `AGENTS.md` and `docs/` stay in the repository for those who change the package. Should agents that use the package from npm get the north star as well?

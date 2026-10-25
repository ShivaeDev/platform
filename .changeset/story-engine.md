---
"@shivaedev/quality": minor
---

### Added

- `tests/story-engine` reports kit stories without traits that never reference their verbs, story or test context. Drive the engine through a kit verb or trait, or move pure code to a `.unit.test.ts` file that reaches no engine and mocks nothing.

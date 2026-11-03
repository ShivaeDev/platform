---
"@shivaedev/test-story": minor
---

### Added

- `story.restart(traits)` starts another engine from the same kit and returns its verbs and story, keeping earlier engines readable in the test Scope.
- `story.apply(traits)` applies traits mid-story in stage order, including after hooks and readable trait refusals.

### Fixed

- Capture every started engine before story Scope cleanup when a story fails.

- Failure reports without an inspect hook print a bounded engine summary without traversing the whole Effect Context or invoking custom inspectors and getters.

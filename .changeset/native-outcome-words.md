---
"@shivaedev/test-story": minor
"@shivaedev/test": minor
---

### Added

- `@shivaedev/test-story`: `server/captureOutcome.ts` provides `captureOutcome` for Effects and `renderOutcome` for Exits, with package-owned renderers for success, expected failure, defect and interruption.

### Breaking

- `@shivaedev/test`: Move the answer-formatting helpers from `@shivaedev/test/answers.ts` to `@shivaedev/test-story/server/answers.ts`. Consumers must depend on `@shivaedev/test-story` and change their imports to the new module; the old module is removed.

---
"@shivaedev/test-story": minor
"@shivaedev/contract": minor
---

### Added

- `@shivaedev/test-story`: `untilAtom` waits for a matching native atom value through its registry subscription and reports `AtomFailed` with the signal name and cause when an AsyncResult atom fails.
- `@shivaedev/contract`: `settledQueries` testing readout observes completed query results within an Effect scope, including failed and equal-value refreshes.

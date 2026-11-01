---
"@shivaedev/changes": minor
---

### Added

- Give native transaction adapters a boundary that restores interruption during connection acquisition and records a commit before pending interruption resumes.

### Breaking

- The native adapter passed to `within` now receives a `TransactionBoundary` as its second argument. Unary adapters remain compatible. Wrap a native combinator that already accepts a second options argument as `(body) => native(body, options)` to keep those options explicit.

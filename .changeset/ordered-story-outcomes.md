---
"@shivaedev/test-story": minor
"@shivaedev/skills": minor
"@shivaedev/quality": minor
---

### Breaking

- `test-story` outcomes now takes an ordered list of `[label, () => readout(), expected]` rows. Migrate each `label: [readout(), expected]` object entry to a tuple and wrap its readout in a callback. Keep labels natural and put rows in their intended run order. Readouts are built only when their row starts. Expected objects match partially at every depth with native `toMatchObject` semantics; arrays retain length and order. Use a plain `expect(...).toEqual(...)` when exact object equality is required.

### Added

- `test-story` exports `lessThan`, `atMost`, `greaterThan` and `atLeast` from `server/adapters/outcomeMatchers.ts` for numeric bounds, including in nested expected values. Failure diffs show the bound and received value.

### Changed

- The shared story-testing skill teaches ordered lazy outcomes, nested partial expectations and numeric bounds. Quality’s grouped-outcomes diagnostic recommends the ordered callback form.

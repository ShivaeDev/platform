---
"@shivaedev/test-story": minor
---

### Added

- Supply a native `Stream<boolean>` as the screen driver's `pending` signal to wake settlement and target searches when application work changes without a DOM mutation.

### Breaking

- Screen settlement and target searches react to DOM mutations instead of polling. Boolean pending samplers run on the initial check and mutations. Migrate samplers that complete work without a mutation to a pending stream. Target searches now wait for pending work to finish and for the target to render, with the existing timeout diagnostics.

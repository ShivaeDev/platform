---
"@shivaedev/form": minor
"@shivaedev/react": minor
---

### Added

- Form and React submission configurations accept a `savedValues` mapping to normalize a successful submission against its captured baseline while retaining later field edits.

### Fixed

- Editors preserve newer received baselines when an earlier save completes, and merge normalized saved fields without erasing later edits.
- Create forms retain optional keys removed while a submission is in flight when resetting their inputs.

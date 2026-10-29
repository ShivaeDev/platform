---
"@shivaedev/create-app": minor
---

### Added

- Generated apps report coverage and JUnit from one stable `CI` job, uploading a `coverage-tests` artifact with commit and job metadata. CI skips draft pull requests, cancels superseded pull-request runs and preserves default-branch measurements. Existing apps receive the workflow through `create-app update`.

---
"@shivaedev/admin": minor
"@shivaedev/create-app": minor
---

### Added

- `JobsView` from `@shivaedev/admin/client/JobsView.ts` renders failed and dead-lettered jobs, readable failure summaries, health, counts, pagination and detail using the application's bound Jobs client and shared queue names. An optional native retry action enables retry for failed originals; the Jobs page's grants remain enforced by its host.

### Changed

- Generated starters use the shared admin Jobs view and include its styles from both standalone and workspace installs.

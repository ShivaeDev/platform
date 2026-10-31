---
"@shivaedev/jobs": minor
"@shivaedev/create-app": minor
---

### Added

- `makePgBoss(identifier, queueNames)` accepts names from a browser-safe module shared with queue definitions and client filters. Each jobs Layer checks that its queue and schedule registrations match the declaration, and fails boot with `PgBossQueueNamesError` listing missing and unexpected names.

### Changed

- Generated applications validate server queue registrations against the shared browser-safe declarations used by the admin Jobs page.

### Breaking

- Jobs Layers include `PgBossQueueNamesError` in their typed startup errors. Consumers with explicit error unions must add this error or handle its tag. Existing services that omit the optional name declaration keep their registration behavior.

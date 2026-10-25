---
"@shivaedev/effect-sql": minor
"@shivaedev/effect-test-sql": patch
"@shivaedev/effect-pg-boss": minor
"@shivaedev/platform": minor
"@shivaedev/create-app": patch
---

### Added

- Migration options accept schema components beside the numbered loader. Components apply after the ledger commits and report pending work through the same readiness check and host wait loop.
- `pgBossSchema` registers pg-boss installation and upgrades as a schema component, reporting the schema's installed and required versions.

### Changed

- Generated apps migrate pg-boss through their migration list and start producers and workers with schema migration disabled.

### Fixed

- Migration-step controllers capture schema-component services when constructed, keeping subsequent migration calls free of external service requirements.

---
"@shivaedev/effect-sql": minor
"@shivaedev/effect-pg-boss": minor
"@shivaedev/platform": minor
"@shivaedev/create-app": minor
---

### Added

- effect-sql records the database release after successful migrations and coordinates worker drain with typed PostgreSQL heartbeat rows.
- effect-pg-boss pauses fetching while the database belongs to another release, finishes active jobs, and resumes when its release owns the database again.
- Platform migration options accept an optional `release` for deployment migration and worker readiness.
- Generated workers step aside for a newer release and drain on SIGTERM, with queue expiry, stop timeout and Railway draining configured together.

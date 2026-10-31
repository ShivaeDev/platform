---
"@shivaedev/identity": minor
---

### Added

- Applications supply Better Auth database hooks as Effects through `betterAuthMount`'s `databaseHooks` option. Mounted requests provide their services, tracing and interruption; typed failures carry an application code and message, and defects remain request defects.

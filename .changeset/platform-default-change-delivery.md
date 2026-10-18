---
"@shivaedev/platform": minor
---

### Added

- Database hosts serve contract change subscriptions, and command declarations publish their remaining invalidation keys after handlers succeed, without repeating keys already announced by their repository commits.

### Breaking

- `appDatabase` and database-backed `appHost` enable PostgreSQL change delivery by default. The channel derives from the application name or database name; `config.changes.channel` overrides it and other change settings remain optional. Use the same application name or channel across web and worker processes. Remove application subscription handlers and repeated command invalidations.

- Direct callers of the low-level `appHostHttp`, `migratedHost` and `deferredHost` builders pass `AppChanges` as the final argument. The ordinary `appHost` call signature stays the same.

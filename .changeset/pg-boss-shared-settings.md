---
"@shivaedev/effect-pg-boss": patch
---

### Changed

- Shared client keys reject different pg-boss constructor settings with `PgBossClientOptionsError`, which names the key and differing options before another client is constructed. Equal settings still share one reference-counted client.

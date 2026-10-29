---
"@shivaedev/work-fleet": minor
---

### Breaking

- `database.url` is required in `fleet.config.json`. A host file without it is rejected at startup instead of connecting to `postgresql://postgres:postgres@127.0.0.1:55432/platform_dev`. Add `"database": { "url": "<postgresql-url>" }` to an existing host file; a host that relied on the old default names that URL.

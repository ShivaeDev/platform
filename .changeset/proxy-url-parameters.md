---
"@shivaedev/test-sql": patch
---

### Fixed

- Route PostgreSQL URLs with `host` or `port` query parameters through the disconnect proxy, so `setReachable(false)` cuts existing connections and refuses new ones.

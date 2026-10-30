---
"@shivaedev/identity": patch
"@shivaedev/sql": patch
---

### Fixed

- Retry command-declared invalidation publication after the handler returns, with two bounded exponential backoffs. Exhausted retries preserve the committed result and resynchronize local live streams, then broadcast Resync to other PostgreSQL hosts when the change channel is reachable.
- Clarify that atomic record and bucket invalidation comes from the stored model and repository; command `invalidates` keys remain after-commit. No consumer API changes or migration are required.

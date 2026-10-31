---
"@shivaedev/identity": patch
---

### Fixed

- Preserve emailed verification and password-reset redirects behind bearer sessions. Browser responses keep redirect, empty and unparseable bodies intact while parseable JSON still has session tokens removed.

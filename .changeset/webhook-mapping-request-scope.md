---
"@shivaedev/webhooks": patch
---

### Fixed

- Run each webhook mapping in its own request scope so acquired resources are released when the request finishes, including on failure or interruption, instead of at application shutdown.

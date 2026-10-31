---
"@shivaedev/jobs": patch
---

### Fixed

- Run pg-boss callbacks through adapters that capture the worker Layer's Effect context, preserving application services in job handlers.

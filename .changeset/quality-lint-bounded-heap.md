---
"@shivaedev/quality": patch
---

### Fixed

- Bound lint's peak memory by running at most two rules concurrently and releasing cached TypeScript source files after each package in `effect/service-parameters`.

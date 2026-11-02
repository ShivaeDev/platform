---
"@shivaedev/work-fleet": patch
---

### Fixed

- Omit the service tier for CI-capacity launches and repairs that select the provider default, so Codex Cloud accepts them. Status names that choice as the provider default and retains the queued-run thresholds.
- Allow explicitly redispatching an approved worker whose launch was rejected before a turn was accepted, using the current host launch settings.

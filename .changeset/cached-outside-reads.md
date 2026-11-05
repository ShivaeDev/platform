---
"@shivaedev/http": minor
---

### Added

- Add `makeReadClient` for outside JSON APIs with a request/body timeout, bounded response decoding, a capacity-bounded success-only TTL cache, source-labelled typed failures, and query-redacted request logs and tracing.
- Add `optionalField` to decode malformed outside fields as absent keys while preserving valid values.

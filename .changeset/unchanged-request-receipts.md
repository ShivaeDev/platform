---
"@shivaedev/events": minor
---

### Added

- Accept empty event batches in `append` to record durable request receipts at the existing stream version without appending events, running projections or publishing change keys. Retries retain the original receipt version after later events.

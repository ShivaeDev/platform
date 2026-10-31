---
"@shivaedev/jobs": minor
"@shivaedev/admin": minor
---

### Added

- Jobs encode and decode durable payloads through Effect's JSON codec, so native `Schema.Redacted` fields reach workers with their real values.

### Fixed

- Job inspection and worker logs mask native `Redacted` values and fields recognized by the errors package's sensitive-key policy. The admin Jobs page carries masked inspection data over RPC without re-encoding it through the payload schema.

### Breaking

- Jobs `getJob`, `failedJobs` and `deadLetteredJobs`, and admin Jobs RPC results, now return masked `data: unknown` instead of a typed worker payload. Consumers must treat this as diagnostic data and narrow it before reading fields; obtain operational payloads in queue handlers. Admin RPC no longer applies the queue's payload encoding or requires its encoding services for results.

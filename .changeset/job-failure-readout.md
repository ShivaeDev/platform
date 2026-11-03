---
"@shivaedev/jobs": minor
"@shivaedev/admin": patch
---

### Added

- `@shivaedev/jobs`: Expose `readJobFailure` to read direct or wrapped pg-boss failures as sanitized `JobFailure | null` values, failing with `PgBossPayloadError` for invalid stored output.

### Fixed

- `@shivaedev/jobs`: Share the failure readout across job details, failed listings and dead-letter source failures, preserving native timeout messages and tags while redacting secrets and removing diagnostic fields.
- `@shivaedev/admin`: Read job failures through jobs' sanitized readout so details and listings expose the same failure messages.

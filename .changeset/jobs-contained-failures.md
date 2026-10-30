---
"@shivaedev/jobs": minor
"@shivaedev/admin": minor
---

### Breaking

- Jobs handler failures persist only `JobFailure` (`_tag` and a redacted `message`); failed and dead-letter listings and admin job responses expose that shape or `null`. Consumers can import the shared `JobFailure` Schema from `@shivaedev/jobs/JobFailure.ts` and must read these fields instead of arbitrary error properties, stacks or causes. Older and native pg-boss failures without a tag decode with `_tag: "Error"`, and their messages are redacted when read; outputs without a string message fail decoding.
- Jobs listings reject invalid page limits and cursors with `SchemaError`; consumers must handle it alongside `PgBossError` and `PgBossPayloadError`. Admin listings report these inputs as `BadRequest`; clients must handle that rejection instead of `JobsUnavailable`.

### Fixed

- Retry wake-up reads run within the worker scope and log redacted failures without failing other jobs in the batch or spending their retries.
- Default pg-boss client error logs redact secrets in messages through `@shivaedev/errors`.

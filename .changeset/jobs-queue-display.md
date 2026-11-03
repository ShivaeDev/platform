---
"@shivaedev/admin": minor
"@shivaedev/jobs": minor
---

### Added

- `@shivaedev/jobs`: Queues and schedules accept display labels, and queues declare subject columns whose fields come from the decoded payload schema.
- `@shivaedev/admin`: The Jobs view accepts queue declarations to show labels and payload subject columns. Subject values use the existing masked inspection payload, including on dead-letter copies grouped under their source queue. String-only queue lists remain supported.

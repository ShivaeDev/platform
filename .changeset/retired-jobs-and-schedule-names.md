---
"@shivaedev/jobs": minor
"@shivaedev/admin": minor
---

### Added

- Jobs Layers accept `retired` queue names, deleting their queues and schedules before registering current workers once the database release is active. Dead-letter queues remain unless explicitly retired. Custom clients can expose native `deleteQueue` and `unschedule` capabilities.
- Jobs health accepts explicit queue names. Jobs admin pages use their declared names for health and accept a browser-safe `{ name }` entry for schedules registered only by a worker, with null payloads for their runs.

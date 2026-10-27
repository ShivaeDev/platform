---
"@shivaedev/admin": minor
"@shivaedev/jobs": minor
"@shivaedev/create-app": minor
---

### Added

- Register schedule definitions beside queues on the admin Jobs page, with null payloads in failed runs, dead-letter listings and job lookups. Pages with no queues can register handlers and serve health.
- Read stored jobs with null payload schemas through the jobs service without changing queue payload validation.
- Show an empty state in the starter Jobs view when no queues or schedules are registered.

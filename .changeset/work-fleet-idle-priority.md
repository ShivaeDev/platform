---
"@shivaedev/work-fleet": minor
---

### Added

- `fleet-priority: low` fills idle execution capacity after prepared normal-or-higher work, without interrupting running low work. Low work still respects held areas and dependencies. Pending low launch retries do not stop normal admission; new provider rejections still pace the scheduler.

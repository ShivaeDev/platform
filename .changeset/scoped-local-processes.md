---
"@shivaedev/supervisor": minor
---

### Added

- Supervise local application processes in per-attempt Effect scopes, with readiness deadlines, captured stdout and stderr, capped exponential restart backoff, and graceful shutdown that escalates to SIGKILL.
- Decode JSON readiness handshakes, compose dependency start order in application Effects, and observe current readiness and typed failures through native Effect values.

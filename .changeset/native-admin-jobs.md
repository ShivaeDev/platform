---
"@shivaedev/admin": minor
"@shivaedev/effect-pg-boss": minor
---

### Added

- `@shivaedev/admin` provides a query-only Jobs page with explicitly registered queues, payload codecs, health, counts, paginated failed and dead-lettered jobs, and job lookup through the protected admin RPC group. Jobs failures remain declared and do not prevent other pages from serving requests.
- `@shivaedev/effect-pg-boss` job reads accept a queue's name and payload Schema without requiring its worker configuration.

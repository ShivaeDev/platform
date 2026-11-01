---
"@shivaedev/rate-limit": minor
"@shivaedev/platform": minor
"@shivaedev/create-app": minor
---

### Added

- Admit per-key budgets through `@shivaedev/rate-limit`, with an Effect-clock memory store, a PostgreSQL adapter, and typed `TooManyRequests` carrying a retry time.
- Include rate limiting in Platform and demonstrate a per-user note creation budget in generated applications.

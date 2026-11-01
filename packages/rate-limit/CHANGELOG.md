# Changelog

## 0.1.0 - 2026-11-01

### Added

- Admit per-key budgets through `@shivaedev/rate-limit`, with an Effect-clock memory store, a PostgreSQL adapter, and typed `TooManyRequests` carrying a retry time.
- Include rate limiting in Platform and demonstrate a per-user note creation budget in generated applications.

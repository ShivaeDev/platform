---
"@shivaedev/contract": patch
---

### Fixed

- Keep per-query headers on automatic live subscriptions and rerun-and-compare reads.
- Reopen a denied hinted query's subscription on explicit refresh so it can return data after access is granted.

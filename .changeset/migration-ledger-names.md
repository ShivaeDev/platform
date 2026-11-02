---
"@shivaedev/sql": patch
---

### Fixed

- Reject a migration ID recorded under a different name with a typed `BadState` migration error before running new migrations, schema components or release publication, matching readiness's ID and name checks.

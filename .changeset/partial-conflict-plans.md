---
"@shivaedev/sql": patch
---

### Fixed

- Match partial unique indexes in conflict writes under PostgreSQL generic plans as well as the default plan mode. Encoded conflict-target predicates use PostgreSQL-quoted constants, with one preliminary quoting query per write; full-index targets and bound write values are unchanged.

---
"@shivaedev/effect-sql": minor
---

### Added

- Repositories expose `count({ where })` with the same filters as `findMany`, returning a decoded number. Omit the filter to count every row; an empty table returns `0`.

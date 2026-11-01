---
"@shivaedev/server": patch
---

### Fixed

- Install PostgreSQL change hooks before preparing hosted migrations so committed repository writes refresh subscribers in other processes exactly once.

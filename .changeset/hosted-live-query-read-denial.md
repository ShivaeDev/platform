---
"@shivaedev/server": patch
---

### Fixed

- A denied per-hint session or query policy recheck ends the hosted live subscription with `QueryReadDenied` instead of silently dropping the hint. Custom consumers must handle this declared failure; automatic bound queries rerun their authorized read so the screen can show the denial.

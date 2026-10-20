---
"@shivaedev/work-fleet": patch
---

### Fixed

- Share in-flight Board scans across daemon readers so concurrent reconciliation reads at most one Board at a time and releases finished snapshots.

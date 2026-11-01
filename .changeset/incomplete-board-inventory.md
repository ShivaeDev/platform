---
"@shivaedev/work-board": minor
"@shivaedev/work-fleet": minor
---

### Fixed

- Work Board reports unreadable child directories by path and keeps identity, search and membership incomplete until they can be read again. Fleet execution records remain visible without an unverified document join.
- Work Fleet refuses to select a Board identity while sources are unavailable.

### Breaking

- Work Board's `Changes.files` is replaced by `Changes.inventory`, which returns `{ files, unavailable }`. Consumers must read `inventory.files` and qualify identity and membership using `inventory.unavailable`. `updateFiles` accepts and returns this inventory. Navigation membership counts are nullable; treat `null` as unknown while the index is incomplete. `listMarkdown` fails when a directory cannot be read; use `scanMarkdown` to inspect readable files alongside unavailable paths.
- Work Fleet Board reads fail with `BoardFailure` code `incomplete-observation` while sources are unavailable. Consumers must treat identity and membership as unknown and retain existing execution state until sources can be read again.

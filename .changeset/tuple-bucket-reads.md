---
"@shivaedev/sql": minor
---

### Added

- A repository read whose filter pins every column of a tuple bucket by equality or `in` records that tuple's keys, one per combination of pinned values, so a live query of alice's entries for day 1 that declares no `reads` reruns only for writes to alice's day 1. A tuple wins over a single-column bucket on one of its columns; a filter that pins a tuple only in part falls back to a single-column bucket it pins, else the table.
- An `in` list that holds `null` pins no column, so a read that also matches rows without a value, such as `latestPerGroup` over `day: { in: [1, null] }`, listens on a broader bucket that hears writes to them. A bucket pinned to more than 1,000 keys is skipped for the next bucket that covers the read, else the table.

---
"@shivaedev/pr-watch": minor
---

### Breaking

- `checkFailures` can return `undefined` when required-check metadata is incomplete. Direct callers must treat `undefined` as pending and retain their last observation until metadata is complete; `true` still means a required failure and `false` means no required failures were observed with sufficient metadata.

### Fixed

- Keep observations pending when required-check metadata omits a failed check or status, or lacks a cursor for remaining pages, instead of saving a snapshot with no failing required checks. Preserve known required failures and resume observations when metadata is complete.

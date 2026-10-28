---
"@shivaedev/work-board": minor
"@shivaedev/work-fleet": minor
---

### Added

- Work Board moves task briefs that are done or dropped and unchanged for fourteen days from `tasks/` to `archive/`, retaining area subfolders, through `work-board archive <board dir>` and automatic housekeeping. Archived briefs retain goal progress, relationships and ID lookup, reserve their IDs, and return to `tasks/` when reopened.

### Fixed

- Board and Fleet skip repository area checks for done, dropped and archived briefs, so renamed or removed folders do not produce diagnostics or warning logs for historical work.

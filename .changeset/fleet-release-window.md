---
"@shivaedev/work-fleet": minor
---

### Added

- Queue integrations can return `{ status: "held", releasePr }` to wait on a named release without requesting a repair.

### Fixed

- Hold PRs that add changesets while an open `release/next` PR has passing required CI, naming the release in Fleet status and Board waits. PRs without new changesets keep merging, and held PRs resume after the release merges or closes.

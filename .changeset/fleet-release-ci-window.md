---
"@shivaedev/work-fleet": patch
---

### Fixed

- Hold PRs that add changesets as soon as the release PR's latest exact-head CI run is approved and queued or in progress. Resume them when that run fails, is cancelled or waits for approval, or the release PR merges or closes.

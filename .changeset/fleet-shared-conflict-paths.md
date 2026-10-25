---
"@shivaedev/work-fleet": patch
---

### Fixed

- Fleet holds a PR for predicted conflicts only in files both PRs change relative to current main, so a stale PR's own conflict with main no longer blocks unrelated work.

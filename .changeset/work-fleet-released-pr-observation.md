---
"@shivaedev/work-fleet": patch
---

### Fixed

- Keep observing reserved PRs after release or renewed preparation and free their areas when they merge or close. Reuse conditional GitHub requests for unchanged PRs, and keep legacy closure decisions from reserving their areas again on release.

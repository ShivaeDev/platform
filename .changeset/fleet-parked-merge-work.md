---
"@shivaedev/work-fleet": patch
---

### Fixed

- Adopt parked merge-main repairs without waiting for areas, review green PRs held on merge ordering, and put reviewed green, mergeable Fleet PRs ahead of conflicting or unreviewed work.
- Observe merge-queue removal while work waits on ordering or areas and continue its worker with the failing check output, then review the repaired head.

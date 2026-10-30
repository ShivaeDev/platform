---
"@shivaedev/work-fleet": patch
---

### Fixed

- Yield between batches when rescanning Board briefs so the daemon can keep serving requests. Completed briefs, including archived briefs, no longer report delivered-id warnings; repeated warnings about reused ids are logged once per change.

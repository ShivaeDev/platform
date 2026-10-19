---
"@shivaedev/work-fleet": patch
---

### Fixed

- Approved work that main leaves behind before dispatch launches on the observed main instead of stopping for a release. A repository-wide preparation assessed as `incomplete-context`, `not-ancestor` or `relevant-change` with no attempts is prepared again in place, and merge prediction reads the newest main without moving the snapshot that admission and dispatch share.
- Work that an earlier dispatch stopped this way is prepared again by the next admission or by `dispatch <id>`, without a release. A local-only criterion still asks for an edit.
- The stop question for a scoped preparation that main left behind says main moved, instead of saying the task needs information the worker cannot reach.

### Fixed

- Ready-to-merge decisions answered with retry and an overall response send the requested changes to the existing worker thread and PR, followed by independent review and checks of its new result. Empty responses retain delivery retry behavior.
- Approved PRs reported as conflicting by GitHub request a main merge from their worker once per conflicting main revision, including across restart. PRs that are only behind main retain approval.

### Added

- Fleet records and cycle snapshots include optional `conflictRepairs: readonly string[]` revision receipts for automatic conflict repair.
- GitHub delivery observation exposes `ConflictingPr extends FleetFailure` with a `mainRevision: string` when an open PR at the adopted head conflicts with its base.

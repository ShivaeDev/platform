---
"@shivaedev/work-fleet": minor
---

### Added

- Predict conflicts against main and watched open PR heads with Git merge-tree, and hold the later PR before review and merge readiness until the earlier PR merges. Continue its worker once to merge main, even after area reservations expire.
- Expose `MergePrediction` and `PredictedConflict` schemas, optional `FleetIntegrations.predict(pr, watchedPrs)` and `MainSource.mergeConflicts(head, otherHeads)` ports, and durable `mergePrediction` and `predictedConflictHold` record fields. Store conflict file names in typed PostgreSQL rows with UTC observation times through an additive migration.

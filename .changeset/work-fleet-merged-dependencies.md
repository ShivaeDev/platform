---
"@shivaedev/work-fleet": patch
---

### Fixed

- Unblock dependencies after a delivery PR merges, including human merges without Fleet approval and older released merges and PRs that merge after release. Preserve observed delivery evidence in the optional `mergedDelivery` field on Fleet records and archived cycles, with the merge commit when known. Reconciliation uses `needsReleasedDelivery(record)` and `observeReleasedDeliveries(state, stored)` to observe unmerged released deliveries, including archived cycles, without reopening their work.
- Accept Board-done dependencies without active Fleet work, including released records, and retain dependency satisfaction after later brief edits. Report every unmet dependency with its actual blocker.

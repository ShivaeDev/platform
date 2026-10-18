---
"@shivaedev/work-fleet": patch
---

### Fixed

- Unblock dependencies after a delivery PR merges, including human merges without Fleet approval and older released merges. Preserve observed delivery evidence in the optional `mergedDelivery` field on Fleet records and archived cycles, with the merge commit when known.
- Accept Board-done dependencies without active Fleet work, including released records, and retain dependency satisfaction after later brief edits. Report every unmet dependency with its actual blocker.

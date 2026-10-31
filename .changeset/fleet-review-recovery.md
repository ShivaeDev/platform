---
"@shivaedev/work-fleet": patch
---

### Fixed

- Detect stalled turns even when the provider supplies no progress snapshots, using the same threshold and retry decision for workers and reviewers.
- Give the existing worker a merge-main repair turn when its PR conflicts during review.
- Continue explicitly stopped work on its existing worker thread after confirmed cancellation.

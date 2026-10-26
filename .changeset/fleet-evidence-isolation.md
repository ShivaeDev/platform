---
"@shivaedev/work-fleet": patch
---

### Fixed

- Select the published PR on a worker branch while ignoring closed, unmerged duplicates, so one merged or open PR resolves the work's evidence; only several open or merged PRs on one branch still wait.
- Keep one item's unreadable published work out of another item's merge prediction, so its failure no longer appears in that item's status.
- Release waiting work whose Board decision `close-finished-decisions` already closed, instead of failing with "Reconcile the exact decision response before answering".

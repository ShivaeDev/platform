---
"@shivaedev/work-fleet": patch
---

### Fixed

- Release area holds while work waits for another PR or sweep to merge, so repairs and answers on the blocking PR can proceed. Resuming workers acquire areas through normal admission.
- Report observed wait cycles and their blocked dependents as stuck in Fleet status and watch, with the work items and PRs involved.

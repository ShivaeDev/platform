---
"@shivaedev/changes": minor
"@shivaedev/sql": minor
---

### Breaking

- Transactions inside `batch` now publish at their outermost transaction's commit, honoring the scoped `CommittedSink`, instead of waiting for the batch to end. Use an enclosing transaction when writes and their changes must commit together, or coalesce in the sink when independent transactions need grouped delivery. Nontransactional batch changes still wait for the batch to end, and rolled-back transactions publish nothing.

### Fixed

- Exceptions in change observers are logged without stopping sink delivery or changing transaction outcomes, including SQL change observations.

---
"@shivaedev/work-fleet": minor
"@shivaedev/work-board": minor
---

### Added

- Fleet supports advisory reviews with the worker’s product context. Completed reviews are saved as linked Board result documents, and their TL;DR appears in ready-to-merge decisions and the Board’s ready list without sending reviewer findings back to the worker.

### Breaking

- `@shivaedev/work-fleet`’s `Review.verdict` also allows `"unavailable"` for an advisory reply without a parseable verdict. Consumers that exhaustively handle verdicts must handle this value and read the retained document for the original reply.

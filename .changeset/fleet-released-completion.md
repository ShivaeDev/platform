---
"@shivaedev/work-fleet": patch
---

### Fixed

- Reconcile stale blockers on released work after its Board item finishes. Done Board work leaves the orchestrator waiting list and counts as done without inventing a delivery outcome. The close-finished-decisions command also reconciles released records when closing their failed answers; dry runs leave them unchanged.

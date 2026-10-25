---
"@shivaedev/work-fleet": patch
---

### Fixed

- Let work launch on areas shared with a queued waiter blocked by another held area or dependency. Resolve free-area contention by priority, preserving queue order within each priority.

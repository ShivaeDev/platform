---
"@shivaedev/work-fleet": patch
---

### Fixed

- Break area and merge-order wait cycles by letting a green PR go first or lending its area to the repair. Keep merge-order exceptions across restart for the same head, and report an unbreakable cycle once instead of on every dependent item.

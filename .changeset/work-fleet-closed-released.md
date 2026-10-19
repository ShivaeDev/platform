---
"@shivaedev/work-fleet": patch
---

### Fixed

- Treat dropped Board tasks as closed when releasing prepared or stopped work, refreshing briefs and closing decisions; never admit closed tasks.
- Re-admit released tasks without a merged delivery on the next admission pass while they remain approved and open, preserving prior cycles and PR reservations so their dependents can proceed after delivery.

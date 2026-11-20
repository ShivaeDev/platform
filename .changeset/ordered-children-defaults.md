---
"@shivaedev/sql": minor
---

### Added

- `makeOrderedChildren` takes the same defaults as `makeRepository`: `idColumn` defaults to `"id"` when the model has an `id` field (a model without one must still name it), and `spanPrefix` defaults to the table name, so its spans read `days.append`, `days.move` and `days.reorder`.
- `makeOrderedChildren` locks the parent row by its `id` column when `parentIdColumn` is left out.

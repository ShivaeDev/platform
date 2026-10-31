---
"@shivaedev/quality": minor
---

### Breaking

- `suppressions/no-double-cast` reports hidden casts outside adapters and test kits: annotated JSON parsing, unchecked reflection bindings, SQL row generics, unchecked identity overloads, Context retagging and writes to readonly or native lifecycle fields. Decode unknown data with `Schema.decodeUnknownEffect` or `SqlSchema`, check implementation return types, and preserve native Context and lifecycle types. Existing repositories can record retained findings during first adoption with a reason.

### Added

- Baseline entries accept an optional `reason`, preserved when debt is lowered or moved.

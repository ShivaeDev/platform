---
"@shivaedev/quality": minor
---

### Added

- `quality fix --rule react/jsx-conditionals` extracts safe conditional children before their return and reports remaining findings, including baseline debt. Rule-specific fixes leave other formatting alone. Unsupported rules explain that they need a manual repair; `tests/grouped-outcomes` remains manual because grouping changes evaluation and failure order.
- Document the starter and generated apps' `pnpm baseline write --rule <id>` upgrade path.

### Breaking

- The exported CLI `Command` type's `Fix` variant now requires a `rules` array. Callers constructing that variant pass `[]` for the existing formatter or the rule ids for mechanical fixes; `parseCommand` supplies the array automatically.

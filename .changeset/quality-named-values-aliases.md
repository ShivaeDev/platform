---
"@shivaedev/quality": minor
---

### Changed

- `tests/named-values` now reports a spec-local numeric const that only feeds `toBe` or `toHaveLength`. Consumers should assert the observed items or derive the value from the story's inputs.

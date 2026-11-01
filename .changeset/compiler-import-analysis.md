---
"@shivaedev/quality": minor
---

### Fixed

- Report tsconfig diagnostics as import findings and honor configured module resolution, path aliases and package export conditions, including NodeNext import and require branches.

### Breaking

- `ImportGraph` includes required `configFindings` metadata. Consumers constructing graphs themselves must supply this array (`configFindings: []` when there are no diagnostics); graphs returned by `importGraph` already include it.

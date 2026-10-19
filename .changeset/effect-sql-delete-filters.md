---
"@shivaedev/effect-sql": minor
---

### Added

- Repositories without a version column accept `delete(where: FindManyFilter<Model>)` with model-typed equality and `{ in: [...] }` filters alongside existing primary-key deletes. List values use field codecs, empty lists delete nothing, and deleted row keys are announced only after commit.

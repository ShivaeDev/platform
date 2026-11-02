---
"@shivaedev/sql": minor
---

### Added

- Repository `upsert` and `upsertMany` accept per-field `add` and `keepOnNull` modes in `updateColumns`, including conditional upserts. Counter additions run atomically in SQL, while null incoming values can preserve stored values; record and bucket changes still publish after commit.

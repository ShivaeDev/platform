### Added

- `makeRepository` accepts a composite `idColumn` tuple; `findById` and `delete` accept the full key object, and updates match every key column through the model's codecs.
- Unversioned repositories with declared `conflictColumns` expose `insertOrIgnore(input)` returning an optional decoded model and `upsert(input, { updateColumns })` returning the inserted or updated model. Inputs use the model's insert schema, selected update columns exclude primary and conflict keys, and writes participate in native transactions. PostgreSQL tests cover these paths.

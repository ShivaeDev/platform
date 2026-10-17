### Added

- Unversioned repositories expose `insertMany(inputs)`. Repositories declaring `conflictColumns` also expose `insertManyOrIgnore(inputs)` and `upsertMany(inputs, { updateColumns })`, with model-derived insert inputs, decoded model arrays, bounded SQL chunks and caller-owned native transactions. Empty batches return an empty array without writing.

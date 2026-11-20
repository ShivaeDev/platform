---
"@shivaedev/sql": minor
"@shivaedev/create-app": patch
---

### Breaking

- `@shivaedev/sql`: `makeRepository` takes its table name from its `collection` and no longer accepts `tableName` beside it; passing both is a compile error. Migrate by deleting `tableName` from every `makeRepository` call that passes a `collection`: `makeRepository(StoredItem, { collection: keys, idColumn: "id", spanPrefix: "Bookmarks", tableName: "bookmarks" })` becomes `makeRepository(StoredItem, { collection: keys, spanPrefix: "Bookmarks" })`, or `makeRepository(StoredItem, { collection: keys })` with the defaults below. A repository without a collection still names its table with `tableName`. An app whose collection name differed from its table name could not build that repository before (it failed with `BucketRegistrationError`); rename the collection to the table's name, which also renames the change keys its live queries listen on.
- `@shivaedev/sql`: `BucketRegistrationError` no longer reports a collection name that differs from the table name, since the collection now names the table. Its message for a bucket model without a collection says to pass the collection in place of `tableName`.
- `@shivaedev/sql`: `RepositoryOptions` takes the model as its first type parameter, `RepositoryOptions<TModel, TId>`, and is a union of the collection form and the `tableName` form.

### Added

- `@shivaedev/sql`: `makeRepository`'s `idColumn` defaults to `"id"` when the model has an `id` field, so `findById` takes the row's id; a model without an `id` field must still name its `idColumn`, or the call does not compile.
- `@shivaedev/sql`: `makeRepository`'s `spanPrefix` defaults to the table name, so a repository on `bookmarks` traces `bookmarks.insert` and `bookmarks.findById`. Pass `spanPrefix` to keep an existing span name.

### Changed

- `@shivaedev/create-app`: A generated resource declares its repository as `makeRepository(StoredItem, { collection: keys })`, taking its table name from the collection and its ID column and span names from the defaults.

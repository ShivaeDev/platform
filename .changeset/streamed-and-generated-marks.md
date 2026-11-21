---
"@shivaedev/errors": minor
"@shivaedev/server": patch
---

### Breaking

- `@shivaedev/errors`: a name that an exported Schema class marks in a `GeneratedSuccess` RPC's success is now masked in that RPC's failures sent to the browser, as a model's names are. An application whose RPC returns such a class and whose declared rejection carries a field of the same name now receives that field masked after upgrading, without a code change: `0` for a number, `<redacted>` for a string, `false` for a boolean, and the other shapes as the README's failure-mask paragraph states them. A defined module's `$changes` carries every query's success, so through a module's live updates every query's rejections lose that field. To migrate, rename the rejection's field when the person must see its value.

### Added

- `@shivaedev/errors`: `schemaSensitiveKeys` collects the names that a `GeneratedSuccess` RPC's success marks, such as the fields of an exported Schema class a generated wire imports, while still leaving that success out of the mixed-visibility check. A raw read decoded with such a class is masked in that RPC's logs, logged defects and traces, and in its module's live updates.

### Changed

- `@shivaedev/server`: `appHost` masks the names of fields that an exported Schema class marks sensitive in every RPC whose success carries the class, its module's `$changes` included, in the RPC's logs, logged defects, failure frames sent to the client and exported traces, as it masks a repository model's names. See the `@shivaedev/errors` entry for the rejection fields this masks and how to migrate.

### Fixed

- `@shivaedev/errors`: `schemaSensitiveKeys` walks the elements a streaming RPC delivers, so a field they mark sensitive, such as a query's success inside a `$changes` update, is masked in that RPC's diagnostics and failures. Before, no streaming RPC, hand-written ones included, masked the marked fields of what it streams. The elements are not checked for mixed visibility, so no group that registered before is refused.
- `@shivaedev/errors`: a Schema class held under `Schema.mutableKey` or another key modifier no longer makes its unmarked fields sensitive, so `{ latest: Schema.mutableKey(Reading) }` masks only the fields `Reading` marks.

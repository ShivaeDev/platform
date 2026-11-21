---
"@shivaedev/errors": minor
---

### Added

- `schemaSensitiveKeys` collects the names that a `GeneratedSuccess` RPC's success marks, such as the fields of an exported Schema class a generated wire imports, while still leaving that success out of the mixed-visibility check. A raw read decoded with such a class is masked in that RPC's diagnostics. As for a model's names, such a name is also masked in the RPC's failures sent to the browser: a declared rejection with a field of the same name now arrives with that field masked, `0` for a number. A defined module's `$changes` carries every query's success, so a rejection of any of its queries delivered through a live subscription arrives masked too. Rename the rejection's field when the person must see its value.

### Fixed

- `schemaSensitiveKeys` walks the elements a streaming RPC delivers, so a field they mark sensitive, such as a query's success inside a `$changes` update, is masked in that RPC's diagnostics and failures. Before, no streaming RPC, hand-written ones included, masked the marked fields of what it streams. The elements are not checked for mixed visibility, so no group that registered before is refused.
- A Schema class held under `Schema.mutableKey` or another key modifier no longer makes its unmarked fields sensitive, so `{ latest: Schema.mutableKey(Reading) }` masks only the fields `Reading` marks.

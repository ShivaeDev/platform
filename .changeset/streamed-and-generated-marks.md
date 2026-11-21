---
"@shivaedev/errors": patch
---

### Fixed

- `schemaSensitiveKeys` walks the elements a streaming RPC delivers, so a field they mark sensitive, such as a query's success inside a `$changes` update, is masked in that RPC's diagnostics. Before, no streaming RPC, hand-written ones included, masked the marked fields of what it streams. The elements are not checked for mixed visibility, so no group that registered before is refused.
- `schemaSensitiveKeys` collects the names that a `GeneratedSuccess` RPC's success marks, such as the fields of an exported Schema class a generated wire imports, while still leaving that success out of the mixed-visibility check. Before, such an RPC ignored the class's `sensitive: true` fields, so a raw read decoded with that class reached diagnostics in clear.
- A Schema class held under `Schema.mutableKey` or another key modifier no longer makes its unmarked fields sensitive, so `{ latest: Schema.mutableKey(Reading) }` masks only the fields `Reading` marks.

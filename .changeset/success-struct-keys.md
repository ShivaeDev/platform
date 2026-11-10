---
"@shivaedev/contract": minor
---

### Added

- The check that a declared success, or a module's wire, equals what `run` returns also compares keys: the keys at each `Schema.Struct` position, including an optional or mutable field and a union member, must equal the keys `run` returns there. An optional property that only one side has is `SuccessDiffersFromRun`, or `WireSuccessStale` for a module's wire, instead of a key the `Struct` drops or never sends.

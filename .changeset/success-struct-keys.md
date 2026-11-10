---
"@shivaedev/contract": minor
---

### Breaking

- The compile-time check of a declared `success`, and of a module's wire, against what `run` returns now fails when an object `run` returns and a `Schema.Struct` in the same position (at the top, or in an array, struct field, tuple, record, union or `Option`) have different keys, such as an optional property only one side has. The `Struct` dropped that key when it encoded, or the browser's type promised a key the server never sends. Such a declaration reports `SuccessDiffersFromRun`, and such a module reports `WireSuccessStale` on its `name` line; regenerate or correct the wire, or the declared `success`, so its struct declares exactly the keys `run` returns.

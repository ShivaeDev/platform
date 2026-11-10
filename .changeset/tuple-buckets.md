---
"@shivaedev/changes": minor
"@shivaedev/sql": minor
---

### Added

- `collection()` takes a fourth argument that declares buckets over an ordered tuple of columns, such as `{ ownerDay: ["ownerId", "day"] }`, and builds each key with `entries.bucket.ownerDay({ ownerId, day })`. A tuple key is an ordinary bucket key, so a query of one owner's day reruns only for writes to that owner and day.
- `decodeBucketValue(schema)` from `@shivaedev/changes/buckets.ts` returns the decoder that `declaredBuckets` uses for bucket values.
- Repository writes announce tuple buckets from the row's old and new stored values: an insert its new tuple, a delete its old one, an update both when any column changed, and no key for a tuple with an absent value.
- `makeRepository` refuses a collection whose tuple names a column the model lacks or one that cannot decode to a string, number or absent value; `BucketRegistrationError` names them in `invalidTupleColumns`.

---
"@shivaedev/sql": minor
---

### Added

- `expectPublished` accepts a function of the successful write result, so generated-id inserts can assert their own record keys.

### Breaking

- Bucket-bearing repositories require their contract collection in `makeRepository`'s `collection` option. Pass the collection already used by query read keys; its name must equal `tableName` and its bucket fields must match the model's `bucket` annotations. Registration fails with the typed `BucketRegistrationError` when declarations disagree or the collection is missing. Handle this new registration error when constructing repositories.

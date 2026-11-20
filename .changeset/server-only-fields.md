---
"@shivaedev/sql": minor
"@shivaedev/build": minor
---

### Added

- `@shivaedev/sql`: `serverOnly(schema)` from `@shivaedev/sql/serverOnly.ts` declares a model field that never leaves the server, such as a password hash or a provider refresh token. It returns the native `Model.Field` whose insert and update variants are `Schema.RedactedFromValue(schema)` and whose select variant is `Schema.RedactedFromValue(schema, { disallowEncode: true })`, with no JSON variants. The column holds the plain value, handlers receive a `Redacted` that prints `<redacted>` in logs and defects, and encoding the stored row for RPC fails with a defect that names the field's path and not its value. Equality, `in` and `deleteBatched` filters on such a field encode the `Redacted` value with its write schema.
- `@shivaedev/sql`: `ServerOnlyKeyError` from `@shivaedev/sql/repositoryCollection.ts`. Building a repository fails with it when a server-only field is the ID column, a bucket or a tuple bucket column, because those values are announced as change keys.

### Breaking

- `@shivaedev/sql`: `makeRepository` can fail with `ServerOnlyKeyError` besides `BucketRegistrationError`. Add it to any error type you wrote out for a repository's construction, or use the new `RepositoryBuildError` union from the same module, such as `Effect.Effect<..., RepositoryBuildError, SqlClient.SqlClient>`.
- `@shivaedev/build`: `generate` refuses an operation whose `run` success holds a `Redacted` anywhere, including in a field of an exported Schema or Model class that it used to write into the wire by name. Such a class, for example a stored row with a `Model.Sensitive(Schema.RedactedFromValue(...))` field, sent its value to the browser in plain text. The refusal names the field's path and says the field never leaves the server. Return a public shape of the row instead, such as `{ id: row.id, owner: row.owner }`. Payloads may still carry a `Redacted`.

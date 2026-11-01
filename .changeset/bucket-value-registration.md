---
"@shivaedev/changes": minor
"@shivaedev/sql": minor
---

### Added

- `@shivaedev/changes/keys.ts` exports `isBucketSchema` to check whether a schema decodes to string or number keys, including nullable and optional model fields. `declaredBuckets` includes this check as `supported`.

### Breaking

- SQL repository registration rejects annotated bucket fields whose decoded schemas cannot be represented by change keys, with `BucketRegistrationError.invalidFields` naming the rejected fields. Use string or number schemas, optionally nullable or optional, for bucket values. Codecs such as `Schema.NumberFromString` remain supported. Replace opaque declarations with an explicit string or number schema and refinements. When constructing `BucketRegistrationError` directly, supply `invalidFields` (an empty array for field-name mismatches).

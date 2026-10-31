---
"@shivaedev/errors": minor
"@shivaedev/server": minor
"@shivaedev/work-board": minor
---

### Fixed

- Derive encoded sensitive names separately for each RPC schema, keeping private fields in one method from changing public state and native failure decoding in another method.

### Breaking

- Refuse RPC registration when a schema-sensitive field name also names a public field within that method's schemas, including nested fields, encoded names and middleware errors. Diagnostics cannot distinguish those plain values. Rename one field or mark both sensitive; fields in separate RPC methods may keep different sensitivity.
- `schemaSensitiveKeys` now returns an Effect. Native consumers must use `yield* schemaSensitiveKeys(group, extraKeys)` to obtain the predicate and handle `SensitiveFieldConflict` from `@shivaedev/errors/schemaFieldScope.ts`. `appHost` and Work Board's `boardLayer` include that failure in their Layer error channels.

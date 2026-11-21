---
"@shivaedev/build": minor
---

### Added

- `generate` maps a branded type `run` returns, including a branded template literal, to the one exported schema in the module's imports whose `Type` is that type, imported from its module, and a record keyed by a branded type to `Schema.Record` over that schema. No fitting schema, or more than one, is refused with the brand's name.
- `generate` maps Effect's `Schema.Json` and `Schema.JsonObject` to the schemas of the same names and `Schema.JsonArray` to `Schema.Array(Schema.Json)`, and `string` or `number` with `boolean`, `true` or `false` to `Schema.Union`. `string | number` and `string | bigint` stay refused, because a NaN or infinite number and a bigint travel as strings, and so does a `Partial` record, whose values may be `undefined`.

---
"@shivaedev/build": minor
---

### Added

- `generate` maps a branded type `run` returns, including a branded template literal, to the one exported schema in the module's imports whose `Type` is that type, imported from its module, and a record keyed by a branded string to `Schema.Record` over that schema, checked with `Schema.isPropertyNames` so a key that fails the brand fails the encoding instead of being dropped. No fitting schema, or more than one, is refused with the brand's name, and a record keyed by a branded number is refused.
- `generate` maps Effect's `Schema.Json` and `Schema.JsonObject` to the schemas of the same names and `Schema.JsonArray` to `Schema.Array(Schema.Json)`, and `string` or `number` with `boolean`, `true` or `false` to `Schema.Union`. `string | number` and `string | bigint` stay refused, because a NaN or infinite number and a bigint travel as strings, and so does a `Partial` record, whose values may be `undefined`.

### Fixed

- `generate` refuses a `Record`, also behind `Partial`, `Readonly` or `Required`, whose keys include a branded literal such as `("a" | "b") & Brand<"Letter">`. TypeScript keeps no property for such a key, so the wire wrote an empty struct and dropped every value under it.

---
"@shivaedev/form": patch
"@shivaedev/react": patch
---

### Changed

- `@shivaedev/form`: `FieldRejectionMapping` no longer requires `rejectField` when a save's error has a plain `string` `field`, such as `Conflict` and `BadRequest` from `@shivaedev/errors/taxonomy.ts`. The default `fieldRejectionOf(fields)` shows a rejection naming a form field on that field and leaves any other rejection, or one without a field, as the save failure. A `field` that includes literal names the form lacks still requires `rejectField`.
- `@shivaedev/react`: `useCreate` and `useEditor` accept a save failing with `Conflict` or `BadRequest` without `rejectField`. Drop `rejectField: fieldRejectionOf(Fields)` where it only repeated the default.

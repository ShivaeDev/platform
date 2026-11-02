---
"@shivaedev/form": minor
"@shivaedev/react": minor
---

### Breaking

- `@shivaedev/form`: Import `FieldRejection`, `RejectField`, `FieldRejectionMapping`, `fieldRejectionOf` and `rejecting` from `@shivaedev/form/fieldRejection.ts` instead of `@shivaedev/react/fieldRejection.ts`. The React module is removed. `FieldRejection.field` now accepts a form path tuple as well as a top-level name; consumers that read it must handle both. Return `{ field: ["profile", "name"] as const, message }` from `rejectField` to attach a save rejection to a nested value.
- `@shivaedev/react`: Import `AtomServices` from `@shivaedev/react/AtomServices.ts` instead of the removed `@shivaedev/react/fieldRejection.ts` module.

### Fixed

- `@shivaedev/form`: Form save rejection mappings pass nested paths to the submitter, so feedback appears on the rejected value. Automatic recognition uses the shared `@shivaedev/errors` decoder.

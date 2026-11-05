---
"@shivaedev/form": minor
---

### Breaking

- Remove the unused `withoutField` export from `@shivaedev/form/messages.ts`. Consumers that remove a field's message should filter the entries of their own message record with `Object.entries` and rebuild it with `Object.fromEntries`.

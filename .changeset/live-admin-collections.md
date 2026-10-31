---
"@shivaedev/contract": minor
---

### Added

- Queries can declare `readsCollections` with `permissionReadPolicy` to refresh admin lists after any committed repository write, using the existing collection key and NOTIFY payloads, including in session-scoped contracts. Ordinary member policies are refused by TypeScript at declaration time and by the server before reading or subscribing.

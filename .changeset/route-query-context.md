---
"@shivaedev/react": minor
"@shivaedev/create-app": minor
---

### Added

- `@shivaedev/react`: `queryRoute` passes the loader's router context to its query factory alongside params and validated search. Annotate `context` with the parent route's `types.allContext` to read declared clients and viewer state with type checking.

### Changed

- `@shivaedev/create-app`: generated starter routes read clients and session state from native router context instead of taking them as route factory parameters.

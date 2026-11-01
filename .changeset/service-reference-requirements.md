---
"@shivaedev/service": patch
---

### Fixed

- Accept native `Context.Reference` keys in `defineService` requirements without treating their `never` identifier as caller-owned `Scope.Scope`.

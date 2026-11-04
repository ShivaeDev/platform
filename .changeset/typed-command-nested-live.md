---
"@shivaedev/contract": patch
"@shivaedev/react": patch
---

### Fixed

- `@shivaedev/contract`: Bound commands with a declared `BadRequest` return payload construction and encoding failures as that typed rejection, including struct-level validation details.
- `@shivaedev/contract`: Live binding discovery traverses nested object and array properties, preserves explicit binding lists, and visits shared objects and cycles once.
- `@shivaedev/react`: Session boundaries mount nested live bindings and apply the session coalescing window to them.

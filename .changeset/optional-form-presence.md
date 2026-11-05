---
"@shivaedev/form": minor
"@shivaedev/react": patch
---

### Added

- `@shivaedev/form`: `omit(name)` and `omitAt(path)` remove optional keys while preserving sibling values.

### Fixed

- `@shivaedev/form`: Dirty tracking, receive, revert and save distinguish missing keys from present `undefined`. Schema-permitted explicit `undefined` remains an assigned value.
- `@shivaedev/react`: Editors preserve keys omitted during save normalization, and create forms preserve omissions through reset.

### Breaking

- `@shivaedev/form`: Paths no longer traverse optional or nullable parents. Read the parent ref to observe absence and use `change` or `changeAt` to supply the complete group, including required siblings.

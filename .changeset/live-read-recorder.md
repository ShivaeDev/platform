---
"@shivaedev/changes": minor
"@shivaedev/contract": minor
---

### Added

- `@shivaedev/changes`: `recordRead(keys)` and the `ReadRecorder` reference in `@shivaedev/changes/readRecorder.ts` let a read name the keys it listens on from its own arguments, before its statement is sent.
- `@shivaedev/contract`: A live query subscription registers each key its handler records with the host the moment it is recorded, before the recording call's statement is sent, and matches recorded keys together with the keys from `reads`, `serverReads` and `readsCollections`.

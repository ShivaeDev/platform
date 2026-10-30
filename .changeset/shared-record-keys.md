---
"@shivaedev/changes": minor
"@shivaedev/sql": minor
---

### Added

- `changes/keys.ts` exports `recordKey` for raw record dependencies and `compositeId` for composite identities, including bigint components encoded as decimal strings.

### Changed

- SQL repository writes and manual invalidations build record keys through `changes/keys.ts`, sharing the format used by subscriptions. Existing key strings remain unchanged.

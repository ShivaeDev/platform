---
"@shivaedev/contract": patch
"@shivaedev/errors": minor
"@shivaedev/server": minor
"@shivaedev/sql": minor
---

### Added

- `@shivaedev/sql`: `RepositoryModels` from `@shivaedev/sql/RepositoryModels.ts`; `makeRepository` and `makeOrderedChildren` declare their model through it while they are built, and its default does nothing.
- `@shivaedev/server`: `appHost` masks the names of fields that a repository model marks sensitive (`sensitive: true` or a Redacted schema), and their encoded names, in every RPC's logs, error reports, failure frames and exported traces, as it masks `config.sensitiveKeys`. The policy is complete before the host serves its first request, so mark a sensitive value once, on the server's model.
- `@shivaedev/errors`: `GeneratedSuccess` from `@shivaedev/errors/GeneratedSuccess.ts`; `schemaSensitiveKeys` leaves the success of an RPC with this annotation out of its sensitive names and its mixed-visibility check.

### Fixed

- `@shivaedev/contract`: a defined module's operations carry `GeneratedSuccess` for every success their wire supplies, so a payload or rejection that marks a name sensitive no longer fails host start or `layerMemoryProtocol` with `SensitiveFieldConflict` when the generated success names it too. Hand-written contracts keep their check.

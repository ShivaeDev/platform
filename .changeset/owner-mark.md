---
"@shivaedev/sql": minor
"@shivaedev/server": minor
---

### Added

- `@shivaedev/sql`: `owner(schema)` from `@shivaedev/sql/owner.ts` marks the one model field that holds the owning person's user id, as an annotation that combines with `bucket`. Building a repository fails with `OwnerFieldError`, naming the table and the fields, when a model marks two owner fields or a server-only owner field.
- `@shivaedev/sql`: `makeRepository` and `makeOrderedChildren` report their table, model and owner field with its column, named as the client's SQL name transform stores them, through `RepositoryModels`, whose new `owned` reads back the owned models. The `collectRepositoryModels` Layer collects them once per model, inside a host or in a story outside one.
- `@shivaedev/server`: `appHost` and `workerHost` collect the owned models their repositories report, so an operation they serve reads them through `(yield* RepositoryModels).owned`.

### Breaking

- `@shivaedev/sql`: `RepositoryModels.declare` receives `{ model, table, owner }` in place of a struct of the model's fields, and the service gains `owned`. An application that provides `RepositoryModels` itself reads the fields from `model.fields` and supplies `owned`, such as `Effect.succeed([])`.
- `@shivaedev/sql`: `RepositoryBuildError` adds `OwnerFieldError`; code that handles each repository build failure by tag handles it too.

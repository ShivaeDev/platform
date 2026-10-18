---
"@shivaedev/effect-sql": minor
"@shivaedev/platform": minor
"@shivaedev/create-app": patch
---

### Added

- effect-sql exports `clientOptions(options, { snakeCase? })` and `SqlNameTransforms` from `clientOptions.ts`. New clients configured with this helper use Effect SQL's native camelCase-to-snake_case query names and snake_case-to-camelCase results by default. Pass `{ snakeCase: false }` to preserve native names, or supply native transform functions in the options.
- Platform's app database and app host configuration accept native `transformQueryNames` and `transformResultNames`, so applications can use effect-sql's client options without replacing the host's database layer.

### Changed

- Newly generated applications configure snake_case SQL columns through effect-sql. The starter migrates existing note ownership and word-count columns while retaining camelCase model fields.

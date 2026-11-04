---
"@shivaedev/github": minor
"@shivaedev/pr-watch": patch
---

### Added

- `@shivaedev/github`: GitHub GraphQL queries share REST authentication, quota observations, bounded responses and installation-token refresh. `graphql(query, variables, schema, options?)` from `@shivaedev/github/graphql.ts` decodes `data` with the caller's Schema and fails with `GitHubGraphqlError` when GitHub returns errors, including with partial data. `decodeGraphqlData` applies the same envelope decoding to responses supplied by an application's transport adapter.

### Changed

- `@shivaedev/pr-watch`: Queue confirmation and required-check reads use github's shared GraphQL transport and envelope decoding while preserving their existing diagnostics and the `GitHubHttp` adapter contract.

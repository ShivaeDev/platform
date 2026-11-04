---
"@shivaedev/github": minor
---

### Breaking

- `graphql()`, the service representation's `decode()` and `decodeGraphqlData()` now return `{ data, errors }`. Read the Schema-decoded answer from `result.data` and inspect `result.errors` for typed message entries; clean responses return an empty errors array. Partial data that matches the caller's Schema succeeds alongside errors. Use nullable fields in the Schema for inaccessible nodes. Errors with absent or null data still fail with `GitHubGraphqlError`. To retain strict rejection of every GraphQL error, fail with `new GitHubGraphqlError({ errors: result.errors })` when `result.errors.length > 0`. To reject errors before validating data, pass `Schema.Unknown`, reject the errors, then decode `result.data` with the application Schema.

---
"@shivaedev/github": minor
---

### Breaking

- Initialize the low-level request cache with `yield* requests(rates)` instead of `requests(client, token, rates, refresh)`. Provide `HttpClient`, `GitHubToken` and, when needed, `TokenRefresh` through the Effect environment. The `GitHub` service API is unchanged.

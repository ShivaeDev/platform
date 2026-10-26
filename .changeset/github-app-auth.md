---
"@shivaedev/effect-github": minor
---

### Added

- Authenticate App-level requests, including Schema-decoded `GET /app` and paginated `GET /app/installations`, with `githubApp({ appId, privateKey })`.
- Downscope installation tokens with `scope.repositoryIds`, `scope.repositories` and `scope.permissions`, including metadata-only access checks; omit the scope for full installation access.
- Refresh a cached installation token after a resource 401 and retry once, sharing replacement exchanges across concurrent requests and preserving a typed failure on a second 401.

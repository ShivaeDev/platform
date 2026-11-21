---
"@shivaedev/github": minor
---

### Fixed

- The GitHub App JWT now expires nine minutes after signing instead of ten. The old `exp` lay exactly at GitHub's documented ten-minute limit, so a host clock ahead of GitHub's put it past that limit; the JWT now ends a minute inside it, which keeps it within the rule while the host clock runs less than a minute ahead of GitHub's.

### Added

- `GitHubAppError` carries GitHub's own `message` as the optional `detail` when GitHub refuses a token exchange or installation lookup with 401, or a token exchange for a suspended installation with 403. The message is redacted like every response excerpt, and the error message names the status and that detail, such as `GitHub refused the App request with HTTP 401: Bad credentials`. A revoked key and a refused JWT no longer both read as a bare 401.

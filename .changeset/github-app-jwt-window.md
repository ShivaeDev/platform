---
"@shivaedev/github": minor
---

### Fixed

- The GitHub App JWT now expires nine minutes after signing instead of exactly ten, so GitHub accepts it while the host clock runs less than a minute ahead of GitHub's. Before, a host clock even a second ahead produced a JWT whose `exp` lay past GitHub's ten-minute limit, and GitHub refused it with 401.

### Added

- `GitHubAppError` from a refused installation lookup or token exchange carries GitHub's own `message` as the optional `detail`, redacted like every response excerpt, and its error message names the status and that detail, such as `GitHub refused the App request with HTTP 401: Bad credentials`. A revoked key and a refused JWT no longer both read as a bare 401.

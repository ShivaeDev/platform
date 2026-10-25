---
"@shivaedev/work-fleet": patch
"@shivaedev/effect-github": minor
---

### Added

- GitHub paged reads accept a caller policy before each request and expose the observed resource for a path.

### Changed

- Fleet reads GitHub over HTTP through effect-github, using `GH_TOKEN`, `GITHUB_TOKEN`, or the existing `gh auth token` login.
- Secondary GitHub rate limits without a retry time back off from one minute, doubling up to fifteen minutes until a successful response resets the wait.

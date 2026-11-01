---
"@shivaedev/github": minor
---

### Added

- One `githubApp` Layer now provides `GitHubApp` and `withInstallation` to share clients across installations, with separate token refresh, conditional caches and rate-limit state. The cache holds at most 100 clients, evicts the least recently used client when full and replaces clients after 30 minutes idle.

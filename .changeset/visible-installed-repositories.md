---
"@shivaedev/github": minor
---

### Added

- `GitHubApp.viewerRepositories(account)` accepts a GitHub account ID or login and returns readable and administrable installed repositories, with access results cached for 60 seconds across at most 100 accounts.

### Fixed

- Keep shared App clients independent of a single-installation Layer's repository and permission scope.

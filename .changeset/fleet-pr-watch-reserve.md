---
"@shivaedev/work-fleet": minor
---

### Added

- `GithubApi.read`, `list` and `post` expose decoded JSON with typed request failures through Fleet's shared GitHub budget.

### Fixed

- PR event watchers share one Fleet GitHub client and stop requests, including pagination, when its resource budget falls below the reserve.

### Breaking

- `watchPrLayer` now requires Fleet's `GithubApi`. Provide a shared `githubApiLayer` or an existing `GithubApi` when composing watcher layers.
- Custom `GithubApi` implementations must supply the decoded-JSON `read`, `list` and `post` methods.

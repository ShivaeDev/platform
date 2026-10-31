---
"@shivaedev/work-fleet": minor
---

### Added

- Queue reviewed, green Fleet PRs through GitHub auto-merge pinned to the reviewed head, reconcile queued work across restarts, and send merge-queue failures back to the worker. Foreign and release PRs retain human merge handling.

### Fixed

- Run merge-main repairs and their review while other work holds the area, so chains of conflicting PRs can drain without an orchestrator answer. Code repairs still use normal area admission.

### Breaking

- Custom `GithubApi` service implementations must provide `write(body)`, which posts a GraphQL request body to GitHub's `graphql` endpoint and returns decoded JSON through the existing typed failure channel. Use `GithubApi.layer` for the standard authenticated implementation, or add this method to a custom service.

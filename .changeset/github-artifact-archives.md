---
"@shivaedev/effect-github": minor
---

### Added

- Download workflow-artifact ZIP archives with `GitHub.downloadArtifactArchive({ owner, repo, artifactId, byteLimit })`. The client reads GitHub's redirect explicitly, requests storage without GitHub credentials, and enforces the caller's byte cap while streaming. Missing or expired artifacts fail with `GitHubArtifactError`; oversized archives stop with `GitHubArtifactTooLarge`. This replaces application-owned redirect handling and archive byte limits.

---
"@shivaedev/github": minor
---

### Fixed

- Installation lookups and token exchanges use the same rate-limit detection and retry deadlines as App and resource requests. Quota exhaustion returns typed `GitHubRateLimited`, and requests fail locally until its deadline instead of repeating authentication requests.

### Breaking

- Effectful `GitHubToken` providers can now fail with `GitHubRateLimited` alongside `GitHubAppError`. Consumers handling authentication failures must also handle `GitHubRateLimited` and use its `retryAt` when scheduling another attempt.

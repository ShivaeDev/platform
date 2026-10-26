---
"@shivaedev/effect-github": minor
---

### Added

- Match sticky comments with `appId` to require the marker at the start of the body, the matching `performed_via_github_app.id` and a bot author. Existing marker-inclusion and optional `author` login matching remain available.
- Classify GitHub's integration permission refusal as `GitHubPermissionDenied` and locked conversations as `GitHubConversationLocked`, each with the request path. Other 403s remain HTTP errors; primary and secondary rate limits retain precedence.

### Breaking

- Permission and locked-conversation 403s now fail with the GitHub-specific errors instead of `RemoteHttpError`. Move handlers for those cases to `Effect.catchTag("GitHubPermissionDenied", ...)` and `Effect.catchTag("GitHubConversationLocked", ...)`; keep `RemoteHttpError` handling for other HTTP refusals.

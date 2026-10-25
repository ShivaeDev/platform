---
"@shivaedev/pr-watch": minor
---

### Changed

- Send GitHub reads, queue-confirmation writes, conditional requests and Link pagination through effect-github. Keep polling slowdown and cooldown scheduling in the watcher, using shared resource observations and rate-limit retry instants. Permission failures retain the saved snapshot without imposing a quota cooldown.

### Breaking

- Provide effect-github’s `GitHub.layer` and `GitHubToken.fromEnv` when composing `GitHubHttp.layer`. Remove `Options.token` and the token arguments to `argumentsFor`, `program` and `GitHubHttp` methods; configure authentication through `GitHubToken` instead. `GitHubHttp.get` and `post` return decoded bodies, and `list` collects paginated bodies. Replace `httpResponse` helpers and `quota.observeBudget`/`Budget` with effect-github; `pollDelay` now accepts its rate-limit observations and an optional retry instant.

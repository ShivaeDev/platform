---
"@shivaedev/pr-watch": minor
"@shivaedev/github": minor
"@shivaedev/work-fleet": minor
---

### Added

- GitHub provides `GitHubToken.fromEnvOrCli`: resolve `GH_TOKEN`, then `GITHUB_TOKEN`, then `gh auth token` through Effect's child-process service. Authentication failures carry `GitHubTokenError` with string reasons and a non-enumerable cause.

### Fixed

- Fleet consumes the shared token provider and pr-watch's typed-failure metadata.
- GitHub transport and artifact failure mappings retain their original non-enumerable cause. Watcher response, state and outage failures retain their causes.

### Breaking

- pr-watch preserves GitHub and HTTP errors in its failure channel. Match their original classes or tags instead of expecting every failure to be `WatchError`. Use `requestFailure` for display and retry metadata; it now returns metadata without replacing the error. `WatchError` requires a string `reason`; use `reason: "cooldown"` instead of `retryable: true` for a local cooldown.
- Replace the removed pr-watch `githubToken` Layer with `GitHubToken.fromEnvOrCli` from `@shivaedev/github/GitHubToken.ts`.
- The CLI uses Effect CLI and NodeRuntime. Signal interruption exits with 130 instead of 0; callers that treat interrupted watches as clean shutdowns must accept 130. Help and parse errors use Effect CLI's format. Replace `argumentsFor` and the static `help` export with `program` for CLI execution or `optionsFor` for validation of parsed settings. `program` now requires Effect CLI's standard environment services. `Watcher.poll` diagnostic callbacks now receive the original typed failure; use `requestFailure(failure).message` to render it. `confirmQueue(options, snapshot)` reads `GitHubHttp` from the Effect environment instead of a service parameter.

- Fleet PR watch streams also preserve these typed failures. Consumers that caught only `WatchError` must match the original GitHub or HTTP failure tags, or the existing authentication `ServiceUnavailable` tag.

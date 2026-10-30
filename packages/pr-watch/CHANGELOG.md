# Changelog

## 0.6.0 - 2026-10-30

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

## 0.5.5 - 2026-10-30

### Changed

- Require Effect 4.0.6 and align the Effect companion package peers and generated starter catalog to the same exact release. Install the 4.0.6 Effect stack together.

### Fixed

- Register hosted RPC cache-control handling through Effect 4.0.6's request-scoped pre-response API so responses keep `private, no-store`.
- Accept native RPC's `application/x-ndjson` media type while preserving `application/ndjson` callers at the transport guard.
- Keep subscriptions open after their HTTP request body completes; closing the socket still cancels them.
- Only failing checks required for the pull request mark it failing or stuck; optional app checks leave queued and auto-merge pull requests unblocked.

## 0.5.4 - 2026-10-29

### Changed

- Release with updated workspace dependencies.

## 0.5.3 - 2026-10-28

### Fixed

- Confirm merge queue removal with GitHub's supported timeline event and preserve its dequeue reason.
- Report GitHub's GraphQL error messages when queue confirmation fails.
- Authenticate PR watching with `GH_TOKEN`, then `GITHUB_TOKEN`, then the signed-in `gh` account. Refuse to start with `GitHub authentication unavailable` when no token is available.

## 0.5.2 - 2026-10-27

### Fixed

- Pace PR polling only when remaining GitHub quota cannot sustain the observed request demand until reset. Ignore expired observations and name the limiting budget, remaining count, limit and reset time in quota pacing cooldowns.

## 0.5.1 - 2026-10-27

### Changed

- Release with updated workspace dependencies.

## 0.5.0 - 2026-10-26

### Added

- Work Fleet watches recorded Board responses once per response, including questions outside running Fleet work, with the question, item and author.
- Work Fleet's JSON watch accepts `--pr-events` to combine Fleet transitions with PR dequeue reasons, stuck queues, conflicts, disabled auto-merge, closed PRs and GitHub health events. Heartbeats are disabled unless `--heartbeat` is set.
- PR Watch exposes its watch runner and production watcher layer for applications that compose its polling engine, and includes GitHub's recorded reason in dequeue events.
- PR Watch reports stuck queue entries with conflicts or failing checks even when GitHub has cleared auto-merge.

## 0.4.5 - 2026-10-26

### Fixed

- Treat merged pull requests as terminal so cleared auto-merge requests and queue entries do not raise alerts, even when the reported state is still open. Auto-merge disabled on an open pull request still raises one alert.

## 0.4.4 - 2026-10-26

### Fixed

- Keep continuous PR watches running through network errors, request timeouts, GitHub server failures and rate limits. Report the failure cause, preserve saved observations and retry with bounded backoff, stopping after one hour without a successful round or immediately on permanent failures.

## 0.4.3 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.4.2 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.4.1 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.4.0 - 2026-10-25

### Added

- Configure quiet heartbeats with `--heartbeat SECONDS` (default 900; `0` disables heartbeats).

### Changed

- Emit heartbeats after a quiet period across polling rounds; every stdout line resets the period. Report quota cooldowns, errors and stops immediately.
- Keep watching when a PR's mergeability is pending: retain its previous snapshot or discovery-only tracking, skip its output and observe it again next round while other PRs continue.

### Breaking

- `GitHub.snapshot` returns `undefined` for pending mergeability instead of failing. Consumers must skip that PR's snapshot replacement and observe it again next round.
- Replace direct `waitForPoll` calls with `makeOutput(emit, heartbeatMilliseconds)` and route PR lines through its `emit` method and waits through its `waitForPoll` method so quiet time spans rounds.

## 0.3.1 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.3.0 - 2026-10-25

### Added

- Select PR transitions with `--events KIND,...`; reject unknown kinds at startup with the valid choices.
- Print unfiltered JSON health lines for heartbeats, errors, quota cooldowns and polling stops on stdout.

### Fixed

- Keep long quota-paced waits visible with interval heartbeats and the next poll time instead of silently sleeping.
- Exit non-zero after a failed round instead of swallowing the error and retrying indefinitely; retain successful snapshots and report rate-limit retry times.
- Keep rate-limit logs out of the CLI's JSON-line stdout stream.

## 0.2.0 - 2026-10-25

### Changed

- Send GitHub reads, queue-confirmation writes, conditional requests and Link pagination through effect-github. Keep polling slowdown and cooldown scheduling in the watcher, using shared resource observations and rate-limit retry instants. Permission failures retain the saved snapshot without imposing a quota cooldown.

### Breaking

- Provide effect-github’s `GitHub.layer` and `GitHubToken.fromEnv` when composing `GitHubHttp.layer`. Remove `Options.token` and the token arguments to `argumentsFor`, `program` and `GitHubHttp` methods; configure authentication through `GitHubToken` instead. `GitHubHttp.get` and `post` return decoded bodies, and `list` collects paginated bodies. Replace `httpResponse` helpers and `quota.observeBudget`/`Budget` with effect-github; `pollDelay` now accepts its rate-limit observations and an optional retry instant.

## 0.1.2 - 2026-10-24

### Changed

- Require Effect and its companion packages at exactly 4.0.5. Generated applications use the same versions.

## 0.1.1 - 2026-10-18

### Fixed

- Publish against `@shivaedev/effect-service` 0.4.0 so consumers share the current service definitions.

## 0.1.0 - 2026-10-13

### Breaking

- Requires stable Effect 4.0.4 in place of 4.0.0-rc.112. Effect 4.0.4 moves the former `effect/unstable/*` modules to `effect/*` and renames constructors such as `Config.string` to `Config.String`. Install `@effect/platform-node` and `@effect/platform-node-shared` 4.0.4 alongside it.

## 0.0.1 - 2026-10-12

### Added

- Emit `queued` when a PR enters the merge queue; report `auto-merge-off` only outside the queue, including a confirmed drop with auto-merge still off.
- Report already-stuck auto-merges on the first observation and stop polling merged or closed PRs while retaining their saved snapshots.
- Confirm missing queue refs against the PR’s GraphQL queue entry and auto-merge state before reporting a drop.
- Use Effect `FileSystem` and `HttpClient` for watcher IO; service layers require these native services, and the CLI supplies them with exact `@effect/platform-node` and `@effect/platform-node-shared` peers.
- Add `pr-watch` for many PRs or every open PR in a repository, with ETag REST polling, quota pacing and merge queue ref observations.
- Emit JSON lines for merged, closed, conflict, dequeued, auto-merge-off, checks-failed and stuck transitions.
- Persist snapshots for clean restart comparison; transient reversed transitions are not recovered and stdout is at-least-once across a crash.

### Fixed

- Fleet discovery keeps open PRs tracked across failed initial observations and clean restarts, so their later merge is reported once even if the first complete snapshot arrives after merging.

# Changelog

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

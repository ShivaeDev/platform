# @shivaedev/pr-watch

One process watches pull request transitions across a repository. It gives an orchestrator event lines for merges, conflicts, queue drops and stuck auto-merges, with a saved snapshot that survives a restart.

## Keep the whole repository in view

Polling each PR with a separate process repeats setup and burns quota. `pr-watch` shares queue discovery, uses REST ETags and discovers new PRs in fleet mode.

```sh
pr-watch --repo acme/project --fleet
```

```json
{"branch":"feature","event":"merged","number":42,"title":"Ship the feature"}
```

Every event occupies one JSON line with its PR number, head branch and title, suitable for the Monitor tool.

## Run the watcher

Each successful observation compares a PR with its saved snapshot. The first observation establishes a baseline. If the PR already has auto-merge enabled with conflicts or failing checks, it immediately emits `stuck` and the corresponding `conflict` or `checks-failed` events. Failed requests, invalid responses and pending mergeability retain the previous snapshot. Checks and queue refs are polled even when the PR detail response is unchanged.

Install with Node 24 or later and the repository's Effect peer version:

```sh
npm install @shivaedev/pr-watch effect@4.0.4 @effect/platform-node@4.0.4 @effect/platform-node-shared@4.0.4
export GH_TOKEN=YOUR_READ_ONLY_TOKEN
pr-watch --repo acme/project 42 57 --state ./watch-state.json
pr-watch --repo acme/project --fleet --interval 60 --state ./fleet-state.json
pr-watch --repo acme/project 42 --once
```

`GH_TOKEN` takes precedence over `GITHUB_TOKEN`. The token needs read access to pull requests, repository refs, check runs and commit statuses. Queue-drop confirmation also uses authenticated GraphQL access to the PR’s merge queue entry and auto-merge request. Without a token, only public repositories are accessible and GitHub's authenticated conditional-request quota exemption does not apply.

Choose explicit PR numbers or `--fleet`. Fleet mode polls all open PRs and discovers PRs opened after startup. Discovery saves open PR numbers before requesting queue refs and full snapshots, so a failed initial observation does not lose the PR. PRs already recorded in the state file stay tracked when they disappear from the open list, so their merge or closure can be observed. After that terminal observation, they stay in the state file but leave the polled set, including after a restart. Keep one watcher per state file. The default state path is `.pr-watch/OWNER-REPO.json`; a file from another repository or an invalid file causes startup to fail instead of resetting history.

`--interval SECONDS` sets the minimum interval (default 60, minimum 1). `--once` performs one observation round and exits; a failed round exits unsuccessfully. `--api-url URL` sets the REST base for GitHub Enterprise or a synthetic server, allowing HTTPS or loopback HTTP. The GraphQL endpoint is the same base with `/graphql` appended, or `/api/graphql` for an Enterprise `/api/v3` REST base. `--help` lists the commands. Diagnostics go to stderr. SIGINT and SIGTERM interrupt the watcher.

### Events

The watcher emits these transitions, once per successful comparison:

| Event | Transition |
| --- | --- |
| `merged` | The PR becomes merged. |
| `closed` | An open PR closes without merging. |
| `conflict` | An open PR's mergeable state becomes `dirty`. |
| `queued` | An open PR enters the merge queue. |
| `dequeued` | A previously queued open PR has no queue ref, and its own queue entry and auto-merge request are both absent. |
| `auto-merge-off` | An open PR's auto-merge is disabled outside the queue after being enabled or queued. |
| `checks-failed` | An open PR changes from no observed failing checks to failing checks. |
| `stuck` | An open PR enters auto-merge enabled with conflicts or failing checks. |

Failure evidence includes completed check runs with `failure`, `timed_out`, `cancelled`, `action_required`, `startup_failure` or `stale`, and combined commit statuses with `failure` or `error`. Pending, successful, neutral and skipped check runs do not count as failures. Checks use the current head SHA and include all response pages. Queue discovery uses the REST matching refs endpoint, recognizing `gh-readonly-queue/.../pr-N-...` names; it does not discover queue membership from auto-merge settings. Entering the queue emits `queued` even when GitHub clears the auto-merge request. A queued PR never emits `auto-merge-off`. When a previously queued open PR loses its refs, a GraphQL request confirms the PR’s own queue entry and auto-merge request. Either one still present retains its previous queue membership during a rebuild. A confirmed drop with auto-merge still off emits both `dequeued` and `auto-merge-off`. A failed, incomplete or errored confirmation retains the last successful snapshot.

### Quota cost

At a 60-second interval, for N open PRs, one page of checks per PR and one page of queue refs, the watcher sends up to `60 × (3N + 1)` REST requests per hour. Fleet mode adds up to `60 × max(1, ceil(open PRs / 100))` discovery requests. Each additional check or queue page adds 60 requests per hour. Each suspected queue drop adds one GraphQL request for that PR in that round. Merged and closed PRs make no further requests after their terminal observation. With no active PRs, queue discovery also stops; fleet discovery continues.

These are request counts, not necessarily charged quota. With authentication, a successful ETag conditional request returning 304 costs zero primary rate-limit quota. Every REST endpoint sends `If-None-Match` after receiving an ETag and reuses its successful cached body on 304. Initial requests, changed responses and endpoints without ETags consume quota normally. Caches are in memory, so a restart makes fresh requests. Secondary limits still apply.

The minimum interval doubles below 50% remaining quota, increases fivefold below 20% and tenfold below 10%. At low quota, the delay also spreads the observed round's request count over the remaining reset window. HTTP 403 and 429 trigger a cooldown of at least the supplied `Retry-After` (60 seconds when absent); exhausted primary quota waits until reset. No further request starts during a known cooldown.

### Restart and delivery limits

The state file records discovered open PR numbers and the last successfully compared snapshot per PR. Snapshot replacement is atomic and follows output. A clean restart compares each persisted open snapshot with the next successful observation, emits the defined events for those differences and does not repeat previously saved events. A discovered PR whose first full snapshot is merged or closed emits that terminal event, including after a failed initial observation or a restart. Differences that do not match an event, such as a title edit, still update the saved snapshot.

Transitions that reverse between observations, including while the watcher is down, are not recovered. For example, leaving and rejoining the merge queue before the next observation produces no `dequeued` event. Stdout delivery is at-least-once across a crash: a crash after output but before the state replacement can repeat a line. There is no event history or acknowledged output protocol.

The exported `StateFile.layer` requires Effect `FileSystem`, and `GitHubHttp.layer` requires Effect `HttpClient`. The CLI supplies `NodeFileSystem.layer` and a `FetchHttpClient` layer that refuses redirects. HTTP and file failures remain typed `WatchError` values.

### Evidence

Synthetic HTTP tests cover conditional 304 responses, all eight events, already-stuck PRs at startup, terminal pruning across restarts, queue entry with a cleared auto-merge request, confirmed queue drops and rebuilds, manual auto-merge disablement, native IO injection and typed failures, checks independent of PR ETags, fleet discovery and pagination, quota slowdown, failed requests, and clean restart comparison. A CLI subprocess test verifies that pending mergeability diagnostics stay on stderr while stdout contains JSON event lines. The packed consumer runs the installed executable against a synthetic server. These tests establish the REST and GraphQL handling and installed package behavior; they do not establish live GitHub or Monitor adoption.

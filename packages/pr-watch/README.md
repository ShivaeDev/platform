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

Each successful observation compares a PR with its saved snapshot. The first observation establishes a baseline and emits no events. Failed requests, invalid responses and pending mergeability retain the previous snapshot. Checks and queue refs are polled even when the PR detail response is unchanged.

Install with Node 24 or later and the repository's Effect peer version:

```sh
npm install @shivaedev/pr-watch effect@4.0.0-rc.112
export GH_TOKEN=YOUR_READ_ONLY_TOKEN
pr-watch --repo acme/project 42 57 --state ./watch-state.json
pr-watch --repo acme/project --fleet --interval 60 --state ./fleet-state.json
pr-watch --repo acme/project 42 --once
```

`GH_TOKEN` takes precedence over `GITHUB_TOKEN`. The token needs read access to pull requests, repository refs, check runs and commit statuses. Without a token, only public repositories are accessible and GitHub's authenticated conditional-request quota exemption does not apply.

Choose explicit PR numbers or `--fleet`. Fleet mode polls all open PRs and discovers PRs opened after startup. PRs already recorded in the state file stay tracked when they disappear from the open list, so their merge or closure can be observed. Keep one watcher per state file. The default state path is `.pr-watch/OWNER-REPO.json`; a file from another repository or an invalid file causes startup to fail instead of resetting history.

`--interval SECONDS` sets the minimum interval (default 60, minimum 1). `--once` performs one observation round and exits; a failed round exits unsuccessfully. `--api-url URL` sets the REST base for GitHub Enterprise or a synthetic server, allowing HTTPS or loopback HTTP. `--help` lists the commands. Diagnostics go to stderr. SIGINT and SIGTERM interrupt the watcher.

### Events

The watcher emits these transitions, once per successful comparison:

| Event | Transition |
| --- | --- |
| `merged` | The PR becomes merged. |
| `closed` | An open PR closes without merging. |
| `conflict` | An open PR's mergeable state becomes `dirty`. |
| `dequeued` | An open PR disappears from `gh-readonly-queue` refs after being present. |
| `auto-merge-off` | An open PR's auto-merge changes from enabled to disabled. |
| `checks-failed` | An open PR changes from no observed failing checks to failing checks. |
| `stuck` | An open PR enters auto-merge enabled with conflicts or failing checks. |

Failure evidence includes completed check runs with `failure`, `timed_out`, `cancelled`, `action_required`, `startup_failure` or `stale`, and combined commit statuses with `failure` or `error`. Pending, successful, neutral and skipped check runs do not count as failures. Checks use the current head SHA and include all response pages. Queue discovery uses the REST matching refs endpoint, recognizing `gh-readonly-queue/.../pr-N-...` names; it does not infer queue membership from auto-merge settings.

### Quota cost

At a 60-second interval, for N open PRs, one page of checks per PR and one page of queue refs, the watcher sends up to `60 × (3N + 1)` REST requests per hour. Fleet mode adds up to `60 × max(1, ceil(open PRs / 100))` discovery requests. Each additional check or queue page adds 60 requests per hour. A closed tracked PR needs one detail request per round rather than three.

These are request counts, not necessarily charged quota. With authentication, a successful ETag conditional request returning 304 costs zero primary rate-limit quota. Every endpoint sends `If-None-Match` after receiving an ETag and reuses its successful cached body on 304. Initial requests, changed responses and endpoints without ETags consume quota normally. Caches are in memory, so a restart makes fresh requests. Secondary limits still apply.

The minimum interval doubles below 50% remaining quota, increases fivefold below 20% and tenfold below 10%. At low quota, the delay also spreads the observed round's request count over the remaining reset window. HTTP 403 and 429 trigger a cooldown of at least the supplied `Retry-After` (60 seconds when absent); exhausted primary quota waits until reset. No further request starts during a known cooldown.

### Restart and delivery limits

The state file records the last successfully compared snapshot per PR with an atomic replacement after output. A clean restart compares each persisted snapshot with the next successful observation, emits the defined events for those differences and does not repeat previously saved events. Differences that do not match an event, such as a title edit, still update the saved snapshot.

Transitions that reverse between observations, including while the watcher is down, are not recovered. For example, leaving and rejoining the merge queue before the next observation produces no `dequeued` event. Stdout delivery is at-least-once across a crash: a crash after output but before the state replacement can repeat a line. There is no event history or acknowledged output protocol.

### Evidence

Synthetic HTTP tests cover conditional 304 responses, all seven events, queue drops, checks independent of PR ETags, fleet discovery and pagination, quota slowdown, failed requests, and clean restart comparison. The packed consumer runs the installed executable against a synthetic server. These tests establish the REST handling and installed package behavior; they do not establish live GitHub or Monitor adoption.

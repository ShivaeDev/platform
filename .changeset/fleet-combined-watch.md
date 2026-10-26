---
"@shivaedev/work-fleet": minor
"@shivaedev/pr-watch": minor
---

### Added

- Work Fleet watches recorded Board responses once per response, including questions outside running Fleet work, with the question, item and author.
- Work Fleet's JSON watch accepts `--pr-events` to combine Fleet transitions with PR dequeue reasons, stuck queues, conflicts, disabled auto-merge, closed PRs and GitHub health events. Heartbeats are disabled unless `--heartbeat` is set.
- PR Watch exposes its watch runner and production watcher layer for applications that compose its polling engine, and includes GitHub's recorded reason in dequeue events.
- PR Watch reports stuck queue entries with conflicts or failing checks even when GitHub has cleared auto-merge.

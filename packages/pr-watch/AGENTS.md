# @shivaedev/pr-watch

This package gives orchestrators one process that observes pull request transitions without wasting GitHub quota on unchanged snapshots. Keep successful observations distinct from missing evidence: a failed request never means a PR closed, a check failed or a queue entry disappeared.

Correct observations win over speed, then durable comparison across restarts, then quota efficiency. Compose services through effect-service and preserve typed failures and interruption. State is a snapshot, not an event history; stdout can repeat across a crash. Applications own delivery and action on events.

Usage is in [README.md](./README.md).

# One process for pull request observations

An orchestrator needs to see merges, conflicts, failed checks and merge queue drops across a repository. One REST watcher shares discovery and queue requests, uses conditional responses, and keeps successful snapshots across restarts.

Evidence wins over speed. A failed or rate-limited request cannot stand in for a negative observation. Check runs and commit statuses belong to the observed head; queue membership comes from the queue refs. Native Effect services own composition and interruption.

Durability means comparison between successful snapshots. It does not recover transitions that reversed between observations. Stdout is at-least-once across a crash. Event history, acknowledged delivery, PR changes and automated reactions belong outside this package.

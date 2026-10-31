---
"@shivaedev/work-fleet": minor
---

### Fixed

- Wait for GitHub to remove a PR from the merge queue for failed checks before sending queue repair work. Repair turns include failed-check URLs from the removed merge-group commit.

### Breaking

- Custom `FleetIntegrations.queue` implementations must return `{ status: "failed", repairPrompt }` instead of `"failed"`, with the failed run's URL in `repairPrompt`. Return `"queued"` or `"pending"` while the PR is queued or failure evidence is unavailable. The fourth argument, `queuedAt`, records when the current head became merge-ready; use it to reject older removal events.

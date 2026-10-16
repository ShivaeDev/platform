### Fixed

- Steer approved brief edits into an active worker or repair turn with a change summary and the full new brief. Persist each revision's steer attempt before delivery so reconciliation and restarts do not repeat it; failed steering retains the new criteria for review.
- Show brief steer requests, acknowledged delivery times and failures in Fleet status. Attempt records and session views expose optional `briefSteers` entries with `revision`, `requestedAt`, optional `steeredAt` and optional `error` fields.

### Added

- Export `briefEditPrompt(previous, current)` for correction prompts, `briefSteerIntent(previous, record, requestedAt)` for durable intent preparation, and `steerBrief(state, stored, previous)` for delivery through the existing session service.

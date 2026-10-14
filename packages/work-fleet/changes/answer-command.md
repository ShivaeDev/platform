### Added

- `work-fleet answer <work-id> [text]` records an orchestrator response to the waiting worker question or Fleet decision. Text can come from stdin. Worker answers continue the same thread; retry text on a reviewed, ready PR requests changes on the same branch and PR. `--release` releases terminal ownership.
- `daemon.answer({ workId, text?, release? })`, `answerCommand` in `host/actionCommands.ts`, and the `answerWork` host helper expose the answer path. `Fleet.publishDecision(workId)` refreshes its durable question registration before resolution.

### Changed

- `status` prints each waiting question or reason followed by its `work-fleet answer` command, including a non-default daemon port. Republished decisions are registered against their current source before answering.

### Fixed

- Answers exceeding Board's 32768-character input limit are rejected before response publication, leaving the waiting question available for a valid answer or release.

### Breaking

- Removed `work-fleet decide`, `daemon.decide`, `decideWork` from `host/decideWork.ts`, and `decideCommand` from `host/actionCommands.ts`. Use `answer`, `daemon.answer`, `answerWork`, and `answerCommand` instead.

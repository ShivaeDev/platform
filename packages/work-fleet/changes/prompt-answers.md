### Added

- `Fleet.recordResponse(workId, decisionId, responseId)` validates a saved Board response, marks it durably and applies it in the Fleet service's background scope. Reconciliation can recover the saved response after a restart.
- `ANSWER_RECORDED` in `attention.ts` identifies pending answer application. `answerWork` and `dispatchApproved` accept optional background/preparation flags, and `daemonRequest` accepts a request name and timeout in milliseconds.

### Fixed

- Daemon answer and dispatch commands acknowledge durable recording before provider work completes. Reconciliation applies saved answers after a restart, and watch reports the outcome.
- Background dispatch preserves explicit approval and the current launch prompt, including when an edited criterion unblocks work before its first attempt.
- CLI request errors distinguish refused connections from timeouts and server failures, name answer and dispatch requests, and say when answer recording is unconfirmed.

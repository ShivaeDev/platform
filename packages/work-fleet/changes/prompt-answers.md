### Added

- `Fleet.recordResponse(workId, decisionId, responseId)` validates a saved Board response, marks it durably and applies it in the Fleet service's background scope. Reconciliation can recover the saved response after a restart.
- `ANSWER_RECORDED` in `attention.ts` identifies pending answer application. `answerWork` accepts an optional background flag, and `daemonRequest` accepts a request name and timeout in milliseconds.
- `DispatchRequest` receipts record acceptance and completion or failure independently of preparation. `dispatchStore(namespace)` persists the latest receipt per item; `dispatchRequests(host)` runs pending requests in the daemon scope and resumes them after a restart. `daemon.dispatch-status` reads the receipt, and `FleetViews.dispatches` exposes pending and failed requests to status.

### Fixed

- Daemon answer and dispatch commands acknowledge durable recording before provider work completes. Reconciliation applies saved answers after a restart, and watch reports the outcome.
- Background dispatch preserves explicit approval and the current launch prompt, including when an edited criterion unblocks work before its first attempt.
- Dispatch records acceptance before refreshing remote main or preparing execution. Status and watch report pending dispatches and background refresh failures even before an execution record exists.
- Watch preserves the current execution and terminal outcome after scheduler recovery from a failed dispatch without another dispatch. The failed receipt remains available through `daemon.dispatch-status`.
- CLI request errors distinguish refused connections from timeouts and server failures, name answer and dispatch requests, and say when answer recording is unconfirmed.

### Breaking

- `ClientContract`'s `daemon.dispatch` returns a `DispatchRequest` receipt instead of a prepared `FleetRecord`.

### Fixed

- The daemon records and applies an answer or release even when the CLI stops waiting for it. Before, a client timeout interrupted the request and the answer was lost.
- Daemon answers and releases share one watched Board response index instead of reindexing the whole Board for every request.
- `work-fleet answer --release` without text no longer waits for stdin.
- Scheduler passes no longer rewrite prepared work whose wait reason is unchanged, and Fleet record lists reuse decoded records that have not changed. A pass over many waiting items stays cheap enough for the daemon to keep answering requests.

### Breaking

- `answerWork` and `releaseItems` require the Board `Responses` service. Provide it with `decisionResponses(host)` or `withDecisionResponses(host, effect)`.

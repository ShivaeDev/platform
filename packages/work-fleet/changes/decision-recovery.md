### Fixed

- Retry starts a fresh reviewer after repeated malformed verdicts, requests a corrected worker report when the reported PR head moved, recovers missing completed-worker receipts and resumes delivery failures at delivery. Retry of a moved-head delivery decision refreshes the current PR and starts a new independent review even when prior review evidence is missing or stale.
- Decisions that require fresh preparation, changed ownership, a shorter immutable report or a human merge offer only release and explain why retry cannot make progress. Release observes unresolved execution without submitting a turn and retains ownership unless execution is confirmed terminal.

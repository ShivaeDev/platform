### Fixed

- Retry starts a fresh reviewer after repeated malformed verdicts, requests a corrected worker report when the reported PR head moved, recovers missing completed-worker receipts and resumes delivery failures at delivery. Retry of a moved-head delivery decision refreshes the current PR and starts a new independent review even when prior review evidence is missing or stale.
- Decisions that require fresh preparation, changed ownership, a shorter immutable report, configured no-change validation, reversal of GitHub report publication or a human merge offer only release and explain why retry cannot make progress. Release observes unresolved execution without submitting a turn and retains ownership unless every known turn is confirmed terminal or an unacknowledged intent is durably fenced before a turn can start.
- The PostgreSQL recovery matrix follows production source references and tests Board report publication, attachment and saved-payload failures after restart, including a closed published PR whose branch has been deleted. Provider failure rows use a synthetic transport; Board rows invoke production report boundaries. Existing-producer, reason-factory fallback and newly referenced Board-producer mutations require new matrix entries. A native SQL connection failure at the repository write boundary also recovers after restart.

### Added

- `SessionFailure` and persisted `Attempt` expose optional `terminalReceipts: readonly SessionReceipt[]`. The native Codex adapter reports all matching receipts for ambiguous duplicate terminal turns, and release verifies each receipt after restart before retiring the attempt. Retry and release retire lost thread acknowledgement intents with a durable fence against late session and turn acknowledgements.

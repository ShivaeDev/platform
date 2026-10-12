### Added

- `DecisionCode` defines stable Fleet decision codes as a Schema literal union. Decisions, preparation assessments and typed integration failures accept an optional `code`; every new Fleet decision and waiting summary records one, and existing stored decisions receive codes during migration.

### Fixed

- Release-only answers, worker-report correction, delivery retries and merge-ready reconciliation use decision codes, so rewording a reason leaves those rules unchanged. The recovery matrix requires a row for every code and exercises retry and release after restart against PostgreSQL.
- `DecisionCode` also includes `session-queue-full` for Codex RPC overload rejections and `provider-quota-unavailable` for quota admission failures. Launch backoff and quota waiting use these codes independently of message wording; integrations can supply them through the existing optional failure code fields.
- `session-active-turn` classifies definite turn rejections backed by active provider turn state. Polling and bounded resubmission use this code and retain it when the wait deadline expires, independently of rejection wording. Exhausted resubmissions use `session-active-turn-exhausted`; a human retry starts a fresh repair thread for the same PR even when the saved reason is reworded. The Codex provider helpers expose `readActiveTurn(readPage)`, its `ReadTurnPage` type, and `codexTurns(rpc).hasActiveTurn(sessionId)` for the shared paginated state observation.
- `pr-conflicting` identifies GitHub conflict decisions. A human retry sends the existing PR to repair before review regardless of the reason text; historical uncoded conflict and exhaustion decisions receive these codes during migration.

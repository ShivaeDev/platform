### Added

- `DecisionCode` defines stable Fleet decision codes as a Schema literal union. Decisions, preparation assessments and typed integration failures accept an optional `code`; every new Fleet decision and waiting summary records one, and existing stored decisions receive codes during migration.

### Fixed

- Release-only answers, worker-report correction, delivery retries and merge-ready reconciliation use decision codes, so rewording a reason leaves those rules unchanged. The recovery matrix requires a row for every code and exercises retry and release after restart against PostgreSQL.
- `DecisionCode` also includes `session-queue-full` for Codex RPC overload rejections and `provider-quota-unavailable` for quota admission failures. Launch backoff and quota waiting use these codes independently of message wording; integrations can supply them through the existing optional failure code fields.
- `session-active-turn` classifies definite turn rejections backed by active provider turn state. Polling and bounded resubmission use this code and preserve it on exhaustion, independently of rejection wording. The Codex provider helpers expose `readActiveTurn(readPage)`, its `ReadTurnPage` type, and `codexTurns(rpc).hasActiveTurn(sessionId)` for the shared paginated state observation.

### Added

- `DecisionCode` defines stable Fleet decision codes as a Schema literal union. Decisions, preparation assessments and typed integration failures accept an optional `code`; every new Fleet decision and waiting summary records one, and existing stored decisions receive codes during migration.

### Fixed

- Release-only answers, worker-report correction, delivery retries and merge-ready reconciliation use decision codes, so rewording a reason leaves those rules unchanged. The recovery matrix requires a row for every code and exercises retry and release after restart against PostgreSQL.

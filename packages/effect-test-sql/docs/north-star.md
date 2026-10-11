# PostgreSQL tests with deliberate lifetimes

Database tests repeat expensive setup and fragile cleanup when each application invents its own fixture lifecycle. The ideal is one migration and fixture preparation for a worker fixture, ordinary tests whose data disappears through rollback, and a deliberate escape for tests that need PostgreSQL to commit.

Native Effect owns Context, Scope, failure, interruption and SQL transaction connections. `effect-test` owns the runner; `effect-sql` owns migrations and commit-bound transactions. This package joins those paths with PostgreSQL database resources. It does not implement another migration engine, pool driver or test runner.

Prepare an immutable template, close its connections, and clone it for the shared database and isolated scenarios. Connection finalizers precede database drops. A rejected or interrupted test must not become a successful test during cleanup. A rolled-back nested transaction uses a savepoint, and a rolled-back test must not publish commit-bound invalidations.

Isolation does not erase PostgreSQL's concurrency rules. Conflicting keyed writes share locks in the ordinary path. Separate databases permit independent data and real commits, while cluster-wide resources still need scenario-specific choices. Preserve these boundaries over a promise of universal concurrency.

# @shivaedev/local-postgres

You are changing the setup utility that makes one persistent local PostgreSQL service available to development and integration tests. Setup is run repeatedly on machines that already hold useful data. Its job is to prepare what is missing and stop when the existing service does not fit, leaving the maintainer in control of data and upgrades. The application's setup script owns its database names, schemas, migrations and seeds.

## Which way to lean

When goals conflict, they win in this order:

1. **Protect existing data.** Never turn a failed readiness check or a version mismatch into permission to replace a container, remove a volume or reset a database. An explicit failure beats a convenient destructive repair.
2. **Keep setup local.** Validate the database destination and the Docker endpoint before acting. When a setup script owns fixed database names, make its allowlist explicit. When names come from configured URLs, rely on preparation's local-target check.
3. **Leave application policy with the application.** Share service preparation and client commands, not a catalogue of application databases, schema fixtures, migration rules or test-cleanup policy.
4. **Keep the setup utility small.** Prefer the existing Node and PostgreSQL tools over another process manager, database client or runtime abstraction. Distinguish a command-path test from proof against real PostgreSQL or Docker. Setup commands are synchronous and never become an application request path; runtime SQL belongs to `sql`, and remote or production provisioning is out of scope.

Read [README.md](README.md) to use the package. Repository-wide guidance remains in the root `AGENTS.md`.

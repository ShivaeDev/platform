# @shivaedev/local-postgres

You are changing the setup utility that makes one persistent local PostgreSQL service available to development and integration tests. Setup is run repeatedly on machines that already hold useful data. Its job is to prepare what is missing and stop when the existing service does not fit, leaving the maintainer in control of data and upgrades. The application's setup script owns its database names, schemas, migrations and seeds.

## Which way to lean

When goals conflict, they win in this order:

1. **Protect existing data.** Never turn a failed readiness check or a version mismatch into permission to replace a container, remove a volume or reset a database. An explicit failure beats a convenient destructive repair.
2. **Keep setup local.** Validate the database destination and the Docker endpoint before acting. Make the application's allowed database names explicit rather than accepting an arbitrary environment URL as authority.
3. **Leave application policy with the application.** Share service preparation and client commands, not a catalogue of application databases, schema fixtures, migration rules or test-cleanup policy.
4. **Keep the setup utility small.** Prefer the existing Node and PostgreSQL tools over another process manager, database client or runtime abstraction. Distinguish a command-path test from proof against real PostgreSQL or Docker.

Read [README.md](README.md) to use the package, [docs/north-star.md](docs/north-star.md) for the full problem and boundaries, and [docs/roadmap.md](docs/roadmap.md) for implementation work and the questions the maintainer owns. Repository-wide guidance remains in the root `AGENTS.md`.

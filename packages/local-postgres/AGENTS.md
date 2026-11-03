# @shivaedev/local-postgres

You are changing the utility that makes one persistent local PostgreSQL service available to development and integration tests, and lets a local application own a separate PostgreSQL child. Both modes run on machines that already hold useful data. Prepare what is missing and stop when the existing data does not fit, leaving the maintainer in control of upgrades. The application owns its database names, schemas, migrations and seeds; an app-owned instance backs up before its migration Effect runs.

## Which way to lean

When goals conflict, they win in this order:
1. **Protect existing data.** Never turn a failed readiness check or a version mismatch into permission to replace a container, remove a volume or reset a database. An explicit failure beats a convenient destructive repair.
2. **Keep setup local.** Validate the database destination and the Docker endpoint before acting. When a setup script owns fixed database names, make its allowlist explicit. When names come from configured URLs, rely on preparation's local-target check.
3. **Leave application policy with the application.** Share service preparation and client commands, not a catalogue of application databases, schema fixtures, migration rules or test-cleanup policy.
4. **Keep the utility small.** Prefer the existing Node and PostgreSQL tools over another process manager, database client or runtime abstraction. App-owned children follow the application's Effect scope and use private Unix sockets; binary discovery stays behind its port. Distinguish a command-path test from proof against real PostgreSQL or Docker. Runtime SQL belongs to `sql`, and remote provisioning is out of scope.

Read [README.md](README.md) to use the package. Repository-wide guidance remains in the root `AGENTS.md`.

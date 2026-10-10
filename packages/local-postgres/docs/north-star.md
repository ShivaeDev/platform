# North star

## The problem

Development and integration tests need PostgreSQL, but each repository has its own database names, schemas and test fixtures. Copying the whole setup script between repositories mixes those application choices with service management. A later shortcut in one copy can replace a container, lose a persistent volume or point a local setup command at a remote machine.

Setup also runs more than once. The developer's useful state must survive another checkout, another dependency install and another test run. A mismatch is a reason to stop and inspect the machine, not a reason to rebuild its database service automatically.

## The ideal

There is one small utility for preparing the shared local service, and each application writes only its own choices. A caller chooses explicit database names, checks incoming URLs against those names, prepares absent databases, and then runs its own schema and seed work. The common utility handles reaching the service and PostgreSQL's command-line client.

Repeated preparation preserves existing data. Locality checks come before a command can act on a database or Docker endpoint. Upgrades are explicit decisions with a data-preservation plan rather than recovery work hidden inside a readiness check.

## What good looks like

- A setup script names the databases it owns and validates configured URLs against those names.
- A service mismatch fails clearly without destructive repair.
- The application owns schemas, migrations, fixture loading, production guards and test cleanup. The package knows none of its domain tables or database naming conventions.
- The common setup path stays visible: ordinary Node tools, PostgreSQL client commands and a fixed local baseline. Application runtime persistence goes through its database client and the framework's SQL path.
- Tests distinguish real database preservation from inspection of generated commands. A test against an already-running PostgreSQL service cannot stand in for a test that starts Docker or exercises a missing client.

## Trade-offs

When these goals conflict, prefer existing data, then an explicit local destination, then application ownership, then a small setup utility.

A fixed service baseline is less flexible than a configurable process manager. It makes one shared machine service easier to reason about and avoids changing the version as a side effect of setup. A machine that needs an upgrade requires a deliberate action outside preparation.

Explicit application name checks add a line to a setup script. That line records which database the script is authorized to prepare; an environment URL alone cannot answer that question.

Synchronous commands are a fit for setup tooling. They should not become an application request path or a second database abstraction. A need for runtime SQL belongs with the native Effect SQL client and repository packages.

## What it deliberately leaves out

- Remote or production database provisioning.
- Automatic upgrades, container replacement, volume removal, database resets and test cleanup policy.
- An application database catalogue, schema authoring, migrations and seeds.
- Query composition, connection pooling, repository APIs or an Effect runtime owner.
- A configurable multi-service process manager.

The [package roadmap](./roadmap.md) owns implementation work and open decisions. The [framework roadmap](https://github.com/ShivaeDev/platform/blob/main/docs/framework/roadmap.md) owns composed database fixtures and host-level validation.

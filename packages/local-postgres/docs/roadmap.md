# Roadmap

This file owns local service preparation, its command paths and package API questions. The [framework roadmap](https://github.com/ShivaeDev/platform/blob/main/docs/framework/roadmap.md) owns composed repository and migration fixtures, application adoption and host-level validation. Their completion status is recorded there rather than repeated here.

## Built

- [x] The main setup module exposes an explicit local server URL, application name validation, service preparation, missing-database preparation and SQL execution.
- [x] Tests reject a remote database host, the wrong port, an unapproved database name and each redirecting query parameter (`host`, `hostaddr`, `port`, `dbname` and `service`). Invalid database identifiers are rejected before preparation. All three setup functions reject remote database targets before connecting.
- [x] A real PostgreSQL test retains an inserted row across repeated preparation and checks PostgreSQL 18.6, including queries whose URLs carry `schema` and `connection_limit` settings.
- [x] Scripted container tests cover daemon failures, starting an existing pinned container, creating a missing container with persistent storage and loopback publication, refusing image mismatches without replacement, and refusing client selection when discovery finds zero or multiple containers.
- [x] Scripted Docker tests cover active and explicit context selection, context precedence over `DOCKER_HOST`, remote endpoint refusal, and local Unix socket, Windows pipe and loopback TCP endpoints.
- [x] The lifecycle test simulates missing host `psql` and delayed container discovery, then checks readiness through the real Docker client and PostgreSQL service. It scripts container startup rather than starting or creating a real container.
- [x] Real PostgreSQL tests check supplied container-client credentials and failure diagnostics on both host and Docker clients, including password-free original errors retained as causes.
- [x] The installed consumer fixture checks the main module's exports and types.

## Next

- [ ] Add a test for rejection of an exact running PostgreSQL version mismatch. Scripted image-mismatch checks do not prove this service-version check.
- [ ] Establish whether parallel setup needs coordinated creation of an absent database; keep application test startup ordered until there is evidence for another contract.

## Open questions

- Should `localPostgres(environment)` configure the environment of its Docker subprocesses, or only validate it? The implementation validates the supplied settings while Docker commands inherit the process environment. The README therefore asks callers to pass the actual process settings. Selecting a different context through the argument would need an explicit API decision and tests.
- Should `docker`, `startContainer` and `sqlInContainer` be supported standalone public APIs? The package's wildcard module exports expose them, while the usage examples and installed consumer fixture use `localPostgres.ts`. Narrowing the exports would change the public API; supporting the helpers would need direct consumer and command-path tests.

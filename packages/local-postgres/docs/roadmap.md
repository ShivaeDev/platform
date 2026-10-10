# Roadmap

This file owns local service preparation, its command paths and package API questions. The [framework roadmap](https://github.com/ShivaeDev/platform/blob/main/docs/framework/roadmap.md) owns composed repository and migration fixtures, application adoption and host-level validation. Their completion status is recorded there rather than repeated here.

## Built

- [x] The main setup module exposes an explicit local server URL, application name validation, service preparation, missing-database preparation and SQL execution.
- [x] Tests reject a remote database host, the wrong port, an unapproved database name and a `host` query redirect. All three setup functions reject remote database targets before connecting.
- [x] A real PostgreSQL test retains an inserted row across repeated preparation and checks PostgreSQL 18.6, including queries whose URLs carry `schema` and `connection_limit` settings.
- [x] The remote `DOCKER_HOST` rejection test checks that SSH and non-loopback TCP endpoints fail before a Docker operation.
- [x] The installed consumer fixture checks the main module's exports and types.

## Next

- [ ] Add focused command-path tests for host-client absence, container client selection, container start/create, image mismatch and exact service-version mismatch. The real preservation test does not prove these branches.
- [ ] Extend destination tests to each redirected connection parameter and invalid database name, and Docker tests to context selection and local endpoint variants.
- [ ] Establish whether parallel setup needs coordinated creation of an absent database; keep application test startup ordered until there is evidence for another contract.

## Open questions

- Should `localPostgres(environment)` configure the environment of its Docker subprocesses, or only validate it? The implementation validates the supplied settings while Docker commands inherit the process environment. The README therefore asks callers to pass the actual process settings. Selecting a different context through the argument would need an explicit API decision and tests.
- Should `docker`, `startContainer` and `sqlInContainer` be supported standalone public APIs? The package's wildcard module exports expose them, while the usage examples and installed consumer fixture use `localPostgres.ts`. Narrowing the exports would change the public API; supporting the helpers would need direct consumer and command-path tests.

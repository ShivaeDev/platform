---
"@shivaedev/local-postgres": minor
"@shivaedev/server": patch
---

### Added

- `@shivaedev/local-postgres`: Read Docker settings through Effect Config with `dockerEnvironment` from `@shivaedev/local-postgres/server/dockerEnvironment.ts`.

### Changed

- `@shivaedev/server`: Database setup shares local-postgres's Docker settings reader.

### Breaking

- `@shivaedev/local-postgres`: Import `PostgresSettingError` from `@shivaedev/local-postgres/server/PostgresSettingError.ts` and `ensureConnections` from `server/ensureConnections.ts` instead of `server/localConnections.ts`.
- `@shivaedev/local-postgres`: Import `DockerEnvironment` from `@shivaedev/local-postgres/server/dockerEnvironment.ts` and `docker` from `server/adapters/docker.ts` instead of `server/localDocker.ts`. Import `localContainer`, `runCommand` and `clientConnection` modules from `server/adapters/` instead of `server/`; their exported names stay the same.

# Changelog

## 0.5.0 - 2026-10-19

### Added

- `PostgresVersionMismatch` from `@shivaedev/local-postgres/PostgresVersionMismatch.ts` identifies a refused running version through `_tag`, `expectedVersion` and `observedVersion`, retaining the existing error message.

## 0.4.2 - 2026-10-18

### Changed

- Setup scripts whose database names come from configured URLs no longer need their own name check; rely on preparation's local-target check. Keep an independent allowlist for setup scripts that own fixed database names.

## 0.4.1 - 2026-10-18

### Changed

- The shared development PostgreSQL container now allows 500 connections. Existing containers are raised on their next start, preserving their data; containers already allowing 500 or more connections are left running unchanged.
- Setting failures throw `PostgresSettingError` from `localConnections.ts`, identifying the container and `max_connections` setting. The lower-level `ensureConnections(docker, sql, ready)` function applies and verifies the setting through the existing synchronous setup API.

## 0.4.0 - 2026-10-18

### Breaking

- Modules are named in camelCase: `local-container.ts` becomes `localContainer.ts`, and `local-docker.ts` becomes `localDocker.ts`.

## 0.3.0 - 2026-10-17

### Added

- `POSTGRES_IMAGE` exports the pinned PostgreSQL image, so CI can pull it before `db:setup` starts the container.
- `localPostgres(environment, { attempts, delayMillis })` sets how many readiness checks `startPostgres` makes after it starts the container and how long it waits between them. The defaults stay at 30 checks one second apart.

### Fixed

- PostgreSQL setup query errors no longer expose connection passwords from userinfo or query parameters through host or Docker client commands, while preserving diagnostics and the original error as `cause`.

## 0.2.1 - 2026-10-16

### Changed

- Document local service preparation, application-owned database names and schemas, data-preservation priorities and test boundaries in the README, agent guidance, north star and roadmap. Publish `docs/` with the README while keeping agent guidance out of the package.
- Build package JavaScript, declarations and source maps with TypeScript 7.

## 0.2.0 - 2026-10-04

### Changed

- Breaking: no root entry and no module that re-exports another. `exports` maps one `"./*.ts"` pattern to every module (`src` under the `source` condition, `dist` otherwise), so you import the module that defines a name, and a bundler sees only the modules you use. Where each name now lives:
  - `@shivaedev/local-postgres`: `@shivaedev/local-postgres/localPostgres.ts` (`assertLocalDatabase`, `localPostgres`, `localServer`)
- The module that was the package entry is `localPostgres.ts`.

## 0.1.1 - 2026-10-04

### Changed

- Imports that leave their folder go through `#` aliases declared in the `imports` field of `package.json`: `#*.ts` resolves to `src` under the `source` condition and to `dist` otherwise, and `#test/*` names a test file. The published modules and declarations name the package's own files through these aliases.

- Build with the `@shivaedev/quality` tsconfig presets, which target ESNext and allow only erasable TypeScript syntax.

- Type-check with TypeScript 7 only. TypeScript 6 still builds the package.

- Lint and format with the `@shivaedev/quality` Biome preset through `quality lint` at the repository root, which replaces the package's `check` script.

- Run tests through the `@shivaedev/quality` Vitest projects, which take a test's environment from its file name. Type tests are named `*.typecheck.test.ts`.

- Keep `package.json` in sort-package-json key order, checked by `quality lint`.

## 0.1.0

- Prepare one persistent local PostgreSQL 18.6 service and create missing databases without resetting existing data.
- Validate loopback database targets and local Docker endpoints; use host or container PostgreSQL client tools.

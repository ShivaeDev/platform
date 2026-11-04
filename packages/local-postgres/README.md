# @shivaedev/local-postgres

Make development and integration tests share one persistent local PostgreSQL service, or let a local application own a private instance. Keep data across starts and leave schema preparation with the application.

## Why you want this

A setup command should make a machine ready to work without erasing the work already on it. Reimplementing PostgreSQL startup in every repository makes that promise harder to keep. This package gives a setup script one place to prepare the service and its databases:

```ts
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { LOCAL_SERVER, localPostgres } from "@shivaedev/local-postgres/server/localPostgres.ts";

NodeRuntime.runMain(
	localPostgres({})
		.prepareDatabases([`${LOCAL_SERVER}/example_dev`])
		.pipe(Effect.provide(NodeServices.layer)),
);
```

The application supplies its configured database URL. Preparation checks that the target is local and can run again without losing the data already in the database.

## Using it

### How to think about it

There are three separate responsibilities:
1. The **service** is PostgreSQL running on the local machine. This package prepares access to it.
2. A **database** is an application-chosen name on that service. This package creates missing databases; the application chooses their names through configuration or a fixed allowlist.
3. The **schema and data** belong to the application. Its setup script runs migrations, loads fixtures or seeds data after preparation.

`localPostgres(environment)` returns three functions that produce Effects: `startPostgres`, `prepareDatabases` and `sql`. Yield them in setup tooling, and provide `ChildProcessSpawner` through the Effect environment. `NodeServices.layer` supplies the Node implementation at an entry point; command scopes preserve interruption and readiness waits use Effect’s clock. Use your application's database client and `@shivaedev/sql` for persistence and migrations in an Effect application.

### 1. Once per application: choose the databases

`prepareDatabases`, `startPostgres` and `sql` each reject remote hosts, ports other than 55432 and redirecting connection parameters: `host`, `hostaddr`, `port`, `dbname` and `service`. Setup scripts can rely on these local-target checks.

When database names come from the application's configured URLs, pass those URLs directly to preparation:

```ts
import { Config, Effect } from "effect";
import { dockerEnvironment } from "@shivaedev/local-postgres/server/dockerEnvironment.ts";
import { LOCAL_SERVER, localPostgres } from "@shivaedev/local-postgres/server/localPostgres.ts";

const setup = Effect.gen(function* () {
	const development = yield* Config.String("DATABASE_URL").pipe(Config.withDefault(`${LOCAL_SERVER}/example_dev`));
	const tests = yield* Config.String("TEST_DATABASE_URL").pipe(Config.withDefault(`${LOCAL_SERVER}/example_test`));
	const environment = yield* dockerEnvironment;
	yield* localPostgres(environment).prepareDatabases([development, tests]);
});
```

Generated applications use this configuration-driven approach. An allowlist built from the same URLs adds no restriction; preparation's own local-target check is the guard.

Use `assertLocalDatabase` when the setup script owns a fixed set of database names, as the Platform repository's [`script/setup-database.ts`](https://github.com/ShivaeDev/platform/blob/main/script/setup-database.ts) does. Its allowlist restricts configuration to the names the script intends to touch:

```ts
import { Effect } from "effect";
import { assertLocalDatabase } from "@shivaedev/local-postgres/server/assertLocalDatabase.ts";
import { LOCAL_SERVER, localPostgres } from "@shivaedev/local-postgres/server/localPostgres.ts";

const setup = Effect.gen(function* () {
	const development = `${LOCAL_SERVER}/example_dev`;
	const tests = `${LOCAL_SERVER}/example_test`;
	yield* Effect.fromResult(assertLocalDatabase(development, ["example_dev"]));
	yield* Effect.fromResult(assertLocalDatabase(tests, ["example_test"]));
	yield* localPostgres({}).prepareDatabases([development, tests]);
});
```

`assertLocalDatabase` applies the same local-target checks and also rejects a database name outside the caller's allowlist. The fixed names above provide an independent application policy.

### 2. Once per feature: prepare its schema in application tooling

After `prepareDatabases`, run the application's own schema or migration entry point. This package provides no schema model, migration ledger, fixture catalogue or seed convention. `@shivaedev/sql` owns the SQL and migration APIs.

### 3. In daily setup: prepare again and inspect with SQL

```ts
import { Effect } from "effect";
import { LOCAL_SERVER, localPostgres } from "@shivaedev/local-postgres/server/localPostgres.ts";

const setup = Effect.gen(function* () {
	const database = `${LOCAL_SERVER}/example_dev`;
	const postgres = localPostgres({});
	yield* postgres.prepareDatabases([database]);
	yield* Effect.log(yield* postgres.sql(database, "SHOW server_version"));
});
```

Run these setup Effects at a Node entry point with `NodeRuntime.runMain(setup.pipe(Effect.provide(NodeServices.layer)))`, as in the first example. The version query returns `18.6` for the managed image; native distributions may append packaging details. `sql` also accepts a `URL` and returns the command's trimmed text. URLs carrying the application's `schema` and `connection_limit` settings work for this query; those settings are removed before calling PostgreSQL's client.

`startPostgres(connection)` prepares the service without choosing an application database to create. Its connection defaults to `LOCAL_SERVER`. Prefer `prepareDatabases` when the setup script needs named databases as well.

On each start, setup reads `SHOW max_connections`. Native servers retain their configured limit. When the running managed container publishes port 55432 and allows fewer than 500 connections, setup applies `ALTER SYSTEM SET max_connections = 500`, restarts that same container, waits for readiness and confirms the setting. Existing data stays in place. A limit of 500 or higher causes no setting change or restart. If the setting cannot be applied, setup fails with `PostgresSettingError` from `@shivaedev/local-postgres/server/PostgresSettingError.ts`, with `_tag`, `container`, `setting` and the original `cause`.

### API

Import service preparation from `@shivaedev/local-postgres/server/localPostgres.ts` and fixed-name validation from `@shivaedev/local-postgres/server/assertLocalDatabase.ts`:

| Export                                                                        | Purpose                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LOCAL_SERVER`                                                                | The base URL `postgresql://postgres:postgres@127.0.0.1:55432`. Append the application database name.                                                                                                                 |
| `assertLocalDatabase(value: string, names: readonly string[])`                | Return a synchronous Effect `Result` validating a local database URL against application-owned allowed names.                                                                                                        |
| `localPostgres(environment: DockerEnvironment, readiness?: ReadinessOptions)` | Create the setup functions using the Docker settings to validate. After starting the container, `startPostgres` checks readiness `attempts` times (default 30), waiting `delayMillis` between checks (default 1000). |
| `prepareDatabases(values: readonly string[])`                                 | Return an Effect preparing the service and creating absent databases.                                                                                                                                                |
| `startPostgres(connection?: string)`                                          | Return an Effect preparing the service; the default connection is `LOCAL_SERVER`.                                                                                                                                    |
| `sql(value: string \| URL, query: string)`                                    | Return an Effect executing SQL through PostgreSQL's command-line client.                                                                                                                                             |

The last three functions are members of the object returned by `localPostgres`, not module-level exports. They fail in the typed error channel. `PostgresCommandError` carries the command, diagnostic message and exit code or platform cause; `LocalPostgresError` describes local-target and image refusals, and malformed URL password escapes. Exhausted readiness checks retain their final failure; a version mismatch always names a version the service returned.

The module export pattern also exposes the lower-level Docker and container command functions in `@shivaedev/local-postgres/server/adapters/docker.ts` and `@shivaedev/local-postgres/server/adapters/localContainer.ts`. Use `@shivaedev/local-postgres/server/localPostgres.ts` for application preparation.

### An instance owned by a local application

`appPostgres` from `@shivaedev/local-postgres/server/appPostgres.ts` initializes a cluster in `dataDirectory` and starts PostgreSQL as a child in the current Effect scope. Closing the scope sends a fast-shutdown signal and waits for the child to exit. The data directory survives; the temporary socket directory is removed. Keep the scope open for the application's lifetime:

```ts
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { hostPostgresBinaries } from "@shivaedev/local-postgres/server/adapters/hostPostgresBinaries.ts";
import { appPostgres } from "@shivaedev/local-postgres/server/appPostgres.ts";

const app = Effect.scoped(
	Effect.gen(function* () {
		const postgres = yield* appPostgres({ dataDirectory: "/path/to/app/data", backupsToKeep: 3 });
		yield* Effect.log(postgres.connectionUrl);
		yield* Effect.never;
	}),
);

NodeRuntime.runMain(app.pipe(Effect.provide(hostPostgresBinaries()), Effect.provide(NodeServices.layer)));
```

The instance listens on a Unix socket in a directory with permissions `0700` and opens no TCP listener. `connectionUrl` selects the `postgres` database and role through that socket. Use it with the application's PostgreSQL client. App-owned mode is separate from the shared development service on port 55432.

Before migrations, yield `migrateAppPostgres(instance, migrations)` from `@shivaedev/local-postgres/server/migrateAppPostgres.ts`. `migrations` is the application's Effect, such as its `@shivaedev/sql` migration entry point. The wrapper finishes a custom-format `pg_dump` before evaluating that Effect. A backup failure prevents the migration from running. Completed dumps live in `dataDirectory/backups`; `backupsToKeep` defaults to five and must be a positive integer. After each completed backup, only the newest configured number of dumps remain. The same module exports `backupAppPostgres(instance)` for an explicit backup; it returns the completed dump's path.

The instance reads its binaries from the `PostgresBinaries` port in `@shivaedev/local-postgres/server/PostgresBinaries.ts`. `hostPostgresBinaries(directory?)` supplies host executables: either from the supplied directory, from `PATH`, or from `pg_config --bindir` when `postgres` is absent from `PATH`. It checks `initdb`, `postgres` and `pg_dump`. Another adapter can supply the port's `initdb`, `postgres` and `pgDump` paths without changing instance management.

Before starting an existing cluster, the instance compares `PG_VERSION` with the server binary's major version. A mismatch fails with `AppPostgresVersionMismatch` from `@shivaedev/local-postgres/server/AppPostgresVersionMismatch.ts`, carrying `dataDirectory`, `expectedMajor` and `observedMajor`. It does not initialize or upgrade that data directory. Choose upgrades and restores outside this package.

App-owned mode needs host PostgreSQL server and client binaries and a Unix-socket-capable system. Its real-instance stories skip with a diagnostic when those binaries are absent; set `PLATFORM_LOCAL_POSTGRES_BIN_DIRECTORY` to run them with a particular installed binary directory.

### Install and machine setup

For shared development and test setup tooling:

```sh
pnpm add --save-dev @shivaedev/local-postgres @effect/platform-node effect
```

For an app-owned instance, install these as runtime dependencies:

```sh
pnpm add @shivaedev/local-postgres @effect/platform-node effect
```

The package requires Node 24 or later and uses Effect as a peer dependency. It needs host `psql` or a local Docker installation. SQL uses host `psql` when available and falls back to the container's client when the host executable is missing. Both clients receive the connection password through `PGPASSWORD`, outside the command line. Query failures retain PostgreSQL's diagnostics and command failure details (and a platform `cause` when a process cannot start) without exposing the connection password.

The shared baseline is PostgreSQL 18.6 on loopback port 55432. Docker preparation uses container and volume name `development-postgres`, loopback publication `127.0.0.1:55432:5432`, and this image:

```text
postgres:18.6-alpine@sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873
```

A newly created container uses username and password `postgres`; connection URLs supply credentials for client commands. Setup accepts native PostgreSQL 18.6 version strings with distribution suffixes, such as `18.6 (Debian 18.6-1.pgdg13+2)`, without requiring a managed container or Docker installation. Setup refuses a running release other than 18.6 with `PostgresVersionMismatch` from `@shivaedev/local-postgres/server/PostgresVersionMismatch.ts`. The error carries `_tag: "PostgresVersionMismatch"`, `expectedVersion` and `observedVersion`. A running PostgreSQL 17 service is refused without losing its existing rows; upgrading it while preserving its data is your job. Container preparation and container-client fallback also check the managed image; a successful host-`psql` version probe does not inspect that image.

Yield `dockerEnvironment` from `@shivaedev/local-postgres/server/dockerEnvironment.ts` and pass its result to `localPostgres`, as in the configuration example. This reader uses Effect Config for `DOCKER_CONTEXT` and `DOCKER_HOST`, with empty defaults that let Docker use its active context. The same module exports the `DockerEnvironment` type. With `DOCKER_CONTEXT`, endpoint validation uses that context and ignores `DOCKER_HOST`; otherwise it validates `DOCKER_HOST` or the active context. Remote endpoints are rejected before a Docker operation. Each operation pins `DOCKER_HOST` to the validated endpoint and clears `DOCKER_CONTEXT`. The lower-level `docker` function refuses command environment settings that conflict with the supplied `DOCKER_HOST` or `DOCKER_CONTEXT` before invoking Docker.

### Limits

- The shared service's version, port, container name and volume name are fixed. Choose any upgrade and data-preservation procedure outside this package.
- Keep shared-service commands in development and test setup tooling. App-owned mode manages the local child's lifetime; runtime queries belong to the application's SQL client.
- Keep allowed names, schema changes, test isolation and cleanup in the application. Preparation is not a database reset.
- A prepared database name has 1–63 lowercase letters, digits or underscores and starts with a letter. An allowlisted connection URL does not bypass this SQL-name constraint.
- Concurrent creation of the same absent database is not supported. Prepare databases before parallel tests begin.

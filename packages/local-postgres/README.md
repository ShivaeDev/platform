# @shivaedev/local-postgres

Make development and integration tests share one persistent local PostgreSQL service. Repeat setup without rebuilding the database contents, and keep each application's database names and schema preparation in its own setup script.

## Why you want this

A setup command should make a machine ready to work without erasing the work already on it. Reimplementing PostgreSQL startup in every repository makes that promise harder to keep. This package gives a setup script one place to prepare the service and its databases:

```ts
import { localPostgres, localServer } from "@shivaedev/local-postgres/server/localPostgres.ts";

const development = process.env.DATABASE_URL ?? `${localServer}/example_dev`;
localPostgres(process.env).prepareDatabases([development]);
```

The application supplies its configured database URL. Preparation checks that the target is local and can run again without losing the data already in the database.

## Using it

### How to think about it

There are three separate responsibilities:

1. The **service** is PostgreSQL running on the local machine. This package prepares access to it.
2. A **database** is an application-chosen name on that service. This package creates missing databases; the application chooses their names through configuration or a fixed allowlist.
3. The **schema and data** belong to the application. Its setup script runs migrations, loads fixtures or seeds data after preparation.

`localPostgres(environment)` returns three synchronous functions: `startPostgres`, `prepareDatabases` and `sql`. Use them in setup tooling. Use your application's database client and `@shivaedev/effect-sql` for persistence and migrations in an Effect application.

### 1. Once per application: choose the databases

`prepareDatabases`, `startPostgres` and `sql` each reject remote hosts, ports other than 55432 and redirecting connection parameters: `host`, `hostaddr`, `port`, `dbname` and `service`. Setup scripts can rely on these local-target checks.

When database names come from the application's configured URLs, pass those URLs directly to preparation:

```ts
import { localPostgres, localServer } from "@shivaedev/local-postgres/server/localPostgres.ts";

const development = process.env.DATABASE_URL ?? `${localServer}/example_dev`;
const tests = process.env.TEST_DATABASE_URL ?? `${localServer}/example_test`;

localPostgres(process.env).prepareDatabases([development, tests]);
```

Generated applications use this configuration-driven approach. An allowlist built from the same URLs adds no restriction; preparation's own local-target check is the guard.

Use `assertLocalDatabase` when the setup script owns a fixed set of database names, as this repository's `script/setup-database.ts` does. Its allowlist restricts configuration to the names the script intends to touch:

```ts
import { assertLocalDatabase, localPostgres, localServer } from "@shivaedev/local-postgres/server/localPostgres.ts";

const development = process.env.DATABASE_URL ?? `${localServer}/example_dev`;
const tests = process.env.TEST_DATABASE_URL ?? `${localServer}/example_test`;

assertLocalDatabase(development, ["example_dev"]);
assertLocalDatabase(tests, ["example_test"]);

const postgres = localPostgres(process.env);
postgres.prepareDatabases([development, tests]);
```

`assertLocalDatabase` applies the same local-target checks and also rejects a database name outside the caller's allowlist. The fixed names above provide an independent application policy.

### 2. Once per feature: prepare its schema in application tooling

After `prepareDatabases`, run the application's own schema or migration entry point. This package provides no schema model, migration ledger, fixture catalogue or seed convention. `@shivaedev/effect-sql` owns the SQL and migration APIs.

### 3. In daily setup: prepare again and inspect with SQL

```ts
import { localPostgres, localServer } from "@shivaedev/local-postgres/server/localPostgres.ts";

const database = process.env.DATABASE_URL ?? `${localServer}/example_dev`;

const postgres = localPostgres(process.env);
postgres.prepareDatabases([database]);
console.log(postgres.sql(database, "SHOW server_version"));
```

The version query returns the string `18.6`. `sql` also accepts a `URL` and returns the command's trimmed text. URLs carrying the application's `schema` and `connection_limit` settings work for this query; those settings are removed before calling PostgreSQL's client.

`startPostgres(connection)` prepares the service without choosing an application database to create. Its connection defaults to `localServer`. Prefer `prepareDatabases` when the setup script needs named databases as well.

On each start, setup reads `SHOW max_connections`. When the shared container allows fewer than 500 connections, setup applies `ALTER SYSTEM SET max_connections = 500`, restarts that same container, waits for readiness and confirms the setting. Existing data stays in place. A limit of 500 or higher causes no setting change or restart. If the setting cannot be applied, setup throws `PostgresSettingError` from `localConnections.ts`, with `_tag`, `container`, `setting` and the original `cause`.

### API

Import the setup API from `@shivaedev/local-postgres/server/localPostgres.ts`:

| Export | Purpose |
| --- | --- |
| `localServer` | The base URL `postgresql://postgres:postgres@127.0.0.1:55432`. Append the application database name. |
| `assertLocalDatabase(value: string, names: readonly string[]): URL` | Validate a local database URL against application-owned allowed names. |
| `localPostgres(environment: DockerEnvironment, readiness?: ReadinessOptions)` | Create the setup functions using the Docker settings to validate. After starting the container, `startPostgres` checks readiness `attempts` times (default 30), waiting `delayMillis` between checks (default 1000). |
| `prepareDatabases(values: readonly string[]): void` | Prepare the service and create absent databases. |
| `startPostgres(connection?: string): void` | Prepare the service; the default connection is `localServer`. |
| `sql(value: string \| URL, query: string): string` | Execute SQL through PostgreSQL's command-line client. |

The last three functions are members of the object returned by `localPostgres`, not module-level exports. They throw on failure; they are synchronous Node functions rather than Effects.

The module export pattern also exposes the lower-level Docker and container command functions in `localDocker.ts` and `localContainer.ts`. Use `localPostgres.ts` for application preparation.

### Install and machine setup

```sh
pnpm add --save-dev @shivaedev/local-postgres
```

The package requires Node 24 or later and has no runtime dependencies. It needs host `psql` or a local Docker installation. SQL uses host `psql` when available and falls back to the container's client when the host executable is missing. Both clients receive the connection password through `PGPASSWORD`, outside the command line. Query failures retain PostgreSQL's diagnostics and the original error as `cause` without exposing the connection password.

The shared baseline is PostgreSQL 18.6 on loopback port 55432. Docker preparation uses container and volume name `development-postgres`, loopback publication `127.0.0.1:55432:5432`, and this image:

```text
postgres:18.6-alpine@sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873
```

A newly created container uses username and password `postgres`; connection URLs supply credentials for client commands. Setup refuses a running version other than 18.6 with `PostgresVersionMismatch` from `@shivaedev/local-postgres/server/PostgresVersionMismatch.ts`. The error carries `_tag: "PostgresVersionMismatch"`, `expectedVersion` and `observedVersion`. A running PostgreSQL 17 service is refused without losing its existing rows; upgrading it while preserving its data is your job. Container preparation and container-client fallback also check the managed image; a successful host-`psql` version probe does not inspect that image.

Pass the process's actual Docker settings to `localPostgres`, as `process.env` in the examples does. With `DOCKER_CONTEXT`, endpoint validation uses that context and ignores `DOCKER_HOST`; otherwise it validates `DOCKER_HOST` or the active context. Remote endpoints are rejected before a Docker operation. Docker subprocesses inherit the process environment. Supplying a different object does not configure those subprocesses.

### Limits

- The service version, port, container name and volume name are fixed. Choose any upgrade and data-preservation procedure outside this package.
- Commands block the calling thread. Keep them in development and test setup tooling.
- Keep allowed names, schema changes, test isolation and cleanup in the application. Preparation is not a database reset.
- A prepared database name has 1–63 lowercase letters, digits or underscores and starts with a letter. An allowlisted connection URL does not bypass this SQL-name constraint.
- Concurrent creation of the same absent database is not supported. Prepare databases before parallel tests begin.

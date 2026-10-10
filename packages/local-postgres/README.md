# @shivaedev/local-postgres

Make development and integration tests share one persistent local PostgreSQL service. Repeat setup without rebuilding the database contents, and keep each application's database names and schema preparation in its own setup script.

## Why you want this

A setup command should make a machine ready to work without erasing the work already on it. Reimplementing PostgreSQL startup in every repository makes that promise harder to keep. This package gives a setup script one place to prepare the service and its databases:

```ts
import { assertLocalDatabase, localPostgres, localServer } from "@shivaedev/local-postgres/localPostgres.ts";

const development = `${localServer}/example_dev`;
assertLocalDatabase(development, ["example_dev"]);
localPostgres(process.env).prepareDatabases([development]);
```

The application chooses `example_dev`. Preparation can run again: the package's real PostgreSQL test inserts a row, repeats preparation and reads the same row back.

## Using it

### How to think about it

There are three separate responsibilities:

1. The **service** is PostgreSQL running on the local machine. This package prepares access to it.
2. A **database** is an application-chosen name on that service. This package creates missing databases; the application explicitly permits their names.
3. The **schema and data** belong to the application. Its setup script runs migrations, loads fixtures or seeds data after preparation.

`localPostgres(environment)` returns three synchronous functions: `startPostgres`, `prepareDatabases` and `sql`. Use them in setup tooling. Use your application's database client and `@shivaedev/effect-sql` for persistence and migrations in an Effect application.

### 1. Once per application: choose and validate the databases

```ts
import { assertLocalDatabase, localPostgres, localServer } from "@shivaedev/local-postgres/localPostgres.ts";

const development = process.env.DATABASE_URL ?? `${localServer}/example_dev`;
const tests = process.env.TEST_DATABASE_URL ?? `${localServer}/example_test`;

assertLocalDatabase(development, ["example_dev"]);
assertLocalDatabase(tests, ["example_test"]);

const postgres = localPostgres(process.env);
postgres.prepareDatabases([development, tests]);
```

This is a complete preparation script for two application-owned databases. `assertLocalDatabase` checks the name against the list the caller supplies. It rejects a remote host, the wrong port, a different database name or a `host` connection parameter that redirects the connection. Preparation and SQL execution also reject remote database targets.

Keep the explicit name checks even though the preparation functions check their destinations. The application's allowlist says which database it intends to touch; service preparation does not choose that policy for it.

### 2. Once per feature: prepare its schema in application tooling

After `prepareDatabases`, run the application's own schema or migration entry point. This package provides no schema model, migration ledger, fixture catalogue or seed convention. In this monorepo, `script/setup-database.ts` chooses the database names and loads test schemas; `@shivaedev/effect-sql` owns the SQL and migration APIs.

### 3. In daily setup: prepare again and inspect with SQL

```ts
import { assertLocalDatabase, localPostgres, localServer } from "@shivaedev/local-postgres/localPostgres.ts";

const database = `${localServer}/example_dev`;
assertLocalDatabase(database, ["example_dev"]);

const postgres = localPostgres(process.env);
postgres.prepareDatabases([database]);
console.log(postgres.sql(database, "SHOW server_version"));
```

The version query returns the string `18.6`. `sql` also accepts a `URL` and returns the command's trimmed text. URLs carrying the application's `schema` and `connection_limit` settings work for this query; those settings are removed before calling PostgreSQL's client.

`startPostgres(connection)` prepares the service without choosing an application database to create. Its connection defaults to `localServer`. Prefer `prepareDatabases` when the setup script needs named databases as well.

### API

Import the setup API from `@shivaedev/local-postgres/localPostgres.ts`:

| Export | Purpose |
| --- | --- |
| `localServer` | The base URL `postgresql://postgres:postgres@127.0.0.1:55432`. Append the application database name. |
| `assertLocalDatabase(value: string, names: readonly string[]): URL` | Validate a local database URL against application-owned allowed names. |
| `localPostgres(environment: DockerEnvironment)` | Create the setup functions using the Docker settings to validate. |
| `prepareDatabases(values: readonly string[]): void` | Prepare the service and create absent databases. |
| `startPostgres(connection?: string): void` | Prepare the service; the default connection is `localServer`. |
| `sql(value: string \| URL, query: string): string` | Execute SQL through PostgreSQL's command-line client. |

The last three functions are members of the object returned by `localPostgres`, not module-level exports. They throw on failure; they are synchronous Node functions rather than Effects.

The package's module export pattern also exposes these lower-level functions:

| Module | Exports |
| --- | --- |
| `@shivaedev/local-postgres/local-docker.ts` | `DockerEnvironment`, the type with optional `DOCKER_CONTEXT` and `DOCKER_HOST`; `docker(environment, args, options?)`, the local-endpoint-checked Docker command function. |
| `@shivaedev/local-postgres/local-container.ts` | `startContainer(docker)`, the container-start function; `sqlInContainer(docker, url, args, options)`, the container SQL-client function. Both take a Docker command callback. |

Use `localPostgres.ts` for application preparation. The lower-level functions describe the command paths it uses and take Node child-process options where shown.

### Install and machine setup

```sh
pnpm add --save-dev @shivaedev/local-postgres
```

The package requires Node 24 or later and has no runtime dependencies. It needs host `psql` or a local Docker installation. SQL uses host `psql` when available and falls back to the container's client when the host executable is missing.

The shared baseline is PostgreSQL 18.6 on loopback port 55432. Docker preparation uses container and volume name `development-postgres`, loopback publication `127.0.0.1:55432:5432`, and this image:

```text
postgres:18.6-alpine@sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873
```

A newly created container uses username and password `postgres`; connection URLs supply credentials for client commands. An existing service with a different version requires an explicit upgrade that preserves its data. Container preparation and container-client fallback also check the managed image; a successful host-`psql` version probe does not inspect that image.

Pass the process's actual Docker settings to `localPostgres`, as `process.env` in the examples does. With `DOCKER_CONTEXT`, endpoint validation uses that context and ignores `DOCKER_HOST`; otherwise it validates `DOCKER_HOST` or the active context. Remote endpoints are rejected before a Docker operation. Docker subprocesses inherit the process environment. Supplying a different object does not configure those subprocesses.

### Limits

- The service version, port, container name and volume name are fixed. Choose any upgrade and data-preservation procedure outside this package.
- Commands block the calling thread. Keep them in development and test setup tooling.
- Keep allowed names, schema changes, test isolation and cleanup in the application. Preparation is not a database reset.
- A prepared database name has 1–63 lowercase letters, digits or underscores and starts with a letter. An allowlisted connection URL does not bypass this SQL-name constraint.
- The PostgreSQL preservation test checks repeated preparation on a real service. It does not establish container creation, image-mismatch handling or host-client fallback.
- Concurrent creation of the same absent database is not covered by the package's tests. Prepare databases before parallel tests begin.

# @shivaedev/local-postgres

Prepare one shared local PostgreSQL service without replacing containers, deleting volumes or resetting data. The service uses PostgreSQL 18.6 on loopback port 55432, pinned to `postgres:18.6-alpine@sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873`.

This Node 24+ package has no runtime dependencies. It uses a local Docker daemon when no service is available; an existing native service requires host `psql`. With Docker, the container provides `psql` when it is absent from the host.

```ts
import { assertLocalDatabase, localPostgres, localServer } from "@shivaedev/local-postgres/localPostgres.ts";

const development = `${localServer}/example_dev`;
assertLocalDatabase(development, ["example_dev"]);
const postgres = localPostgres(process.env);
postgres.prepareDatabases([development]);
```

`localPostgres(environment)` reads only `DOCKER_CONTEXT` and `DOCKER_HOST` from the supplied settings. Pass the actual process environment or both settings from the application's configuration service so remote Docker endpoints are rejected. Importing this package does not start a service.

`prepareDatabases(urls)` starts or reuses the service, checks its version and creates missing databases. `startPostgres(connection)` only prepares the service. `sql(connection, query)` uses host `psql`, or the pinned container's client. Database connection settings come from the supplied URL, including credentials. A new container uses the documented local defaults and a persistent `development-postgres` volume; it is never automatically upgraded.

`assertLocalDatabase(url, names)` permits only the supplied names on localhost or 127.0.0.1 port 55432. It rejects connection parameters that override the destination. Callers own their application-specific names, test isolation, schema initialization, migrations and seeds. This package does not select application databases or run migrations or seeds.

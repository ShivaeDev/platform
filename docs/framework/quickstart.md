# Start a Platform app

Use Node 24 or newer and the pnpm version in the starter's `packageManager` field. The [starter](../../examples/starter) is a private notes app with PostgreSQL, the app host of `server`, RPC, shared query state, routing, a form, Vite, React and Tailwind with stock shadcn components.

1. Run `pnpm create @shivaedev/app my-app`, then `cd my-app`. The command writes the starter with `@shivaedev/platform` at its exact published version as the one framework dependency and `publicHoistPattern: ["@shivaedev/*"]` in `pnpm-workspace.yaml`, keeps its self-contained pnpm catalog, installs dependencies, and generates a git-ignored `.env.local` with a fresh authentication secret and `my_app_dev`/`my_app_test` database URLs. Use an absent or empty folder; existing files are never overwritten.
2. Run `pnpm dev` and open `http://127.0.0.1:5173`. It first runs `pnpm db:setup` to prepare both databases through `@shivaedev/local-postgres`; have local PostgreSQL 18.6 on port 55432 or Docker available. The server and background worker watch TypeScript, Vite serves React, and `pnpm migrate` applies migrations, including Better Auth's tables, before either process starts. Follow the sign-in link, create an account, then add a note. The worker counts each note's words; the count appears without refreshing. Sign out and sign back in to see your saved notes.

Run `pnpm test` to load `TEST_DATABASE_URL` from `.env.local` and test the app against its dedicated local test database. Run `pnpm db:setup` separately when you want to prepare databases without starting development. See [local-postgres machine setup](../../packages/local-postgres/README.md#install-and-machine-setup) for the shared local service requirements.

The command initializes Git when it is available and the target is outside an existing repository, then runs `pnpm run setup` to install dependencies and Quality's pre-commit hook before staging the generated files and installed lockfile. The first commit runs the hook's lint and typecheck gates; a failed gate leaves it uncommitted. Pass `--no-git` to skip repository creation. Setup installs a hook only when the app has its own `.git`, so it leaves an enclosing repository's hooks alone. After cloning the generated repository, run `pnpm run setup` to install dependencies and the hook for that checkout. In the generated app, run `pnpm ready` for the full local gate: lint, typecheck, build and tests. Run `pnpm lint` to check the shared Quality policy and `pnpm format` to apply its fixes and formatting. The starter's `biome.json` extends `@shivaedev/quality/biome/preset.json`; no Quality config or baseline is needed. The included `.github/workflows/ci.yml` runs the same checks through `pnpm run ci` against a PostgreSQL service on pushes and pull requests.

The starter passes queue definitions to the jobs package's `NoteJobs.layer({ connectionString, jobs: [CountWords] })` to create its queues and dead-letter queues before serving requests, without starting a consumer. The separate worker registers the handler.

Change the example’s shared operations in `src/modules/notes/notes.ts`, its table and services in `src/modules/notes/server`, and its screen in `src/modules/notes/client`. The CSS declaration is local; no `vite/client` types are needed. `pnpm build && pnpm migrate && pnpm start` serves the built app on port 3000; run `pnpm worker` in a second process to handle jobs.

The notes route loads an authenticated RPC query; the create command is also protected. Missing or revoked sessions return typed `Unauthorized` failures that the UI presents as a sign-in prompt. Each account sees its own notes. `SessionBoundary` replaces the query registry and drafts when the session changes. Better Auth's HTTP endpoints share the app host at `/api/auth/*`; Vite proxies both auth and RPC to that host during development.

The starter uses strict application checking with `skipLibCheck: true`, matching Quality's application configuration. Better Auth's published declarations also reference runtimes this Node app does not use. Auth options live in `src/server/authOptions.ts`; the foundation migration `src/server/migrations/0001_auth.ts` calls Better Auth's [programmatic migration API](https://better-auth.com/docs/concepts/database#programmatic-migrations), so no separate auth CLI step is needed. With `PUBLIC_URL` unset, auth accepts both `127.0.0.1` and `localhost` over HTTP on any port, including `http://localhost:5173` through the development proxy. `betterAuthMount` defaults `baseURL.allowedHosts` to `["127.0.0.1:*", "localhost:*"]` and `trustedOrigins` to `["http://127.0.0.1:*", "http://localhost:*"]`. Explicit `baseURL` (including `baseURL.allowedHosts`) and `trustedOrigins` in `authOptions.ts` replace their corresponding defaults; their lists are not merged.

## Administer the app

The starter registers its Jobs and note-statistics pages through [`@shivaedev/admin`](../../packages/admin/README.md). Open `/admin` in development on port 5173 or in the built app on port 3000. Vite serves the React routes and proxies their `/rpc` requests to the same app host as notes. The Jobs page shows health, queue counts, failed and dead-lettered jobs and job detail; `/admin/notes` shows aggregate statistics across users.

After `pnpm migrate`, provision an administrator with a new email address:

```sh
ADMIN_EMAIL=operator@example.com ADMIN_PASSWORD='a-long-unique-password' pnpm admin:create
```

Sign in with those credentials, then open `/admin/jobs`. The command uses the server's `DATABASE_URL` and `BETTER_AUTH_SECRET`; `ADMIN_NAME` defaults to `Administrator`. Existing email addresses are rejected. Every admin query and change subscription requires its declared domain permission (`jobs.read`, `users.read` or `notes.statistics.read`): signed-out requests receive `Unauthorized`, and roles without that grant receive `Forbidden`.

The registry in `src/modules/notes/admin.ts` lists the authored pages; `src/modules/notes/server/adminRegistration.ts` supplies handlers on the existing `/rpc` host. Each page wraps a native contract. The default Jobs page declares no commands. Retry requires an explicit `jobsPageWithRetry` contract, `jobsHandlersWithRetry` registration and a bound retry action in the app view. React views belong to the application; the admin package adds no UI components or transport.

`--minimal` omits the notes module and its page registrations. Its foundation and reusable admin views compile independently of notes. Add page declarations, handlers and client routes with your own module when you need operator tooling.

## Add a job

Give the queue's name and payload Schema a browser-safe module, as `src/modules/notes/queue.ts` does, and pass it to `defineQueue` in the module's `server/jobs.ts`. The module's server registration supplies a producer Layer that registers the queue definitions without starting a consumer, as `server/producer.ts` does. Register the handler in the module's `server/worker.ts` and add that worker to `src/server/workerModules.ts`; the worker process runs on the host's `appDatabase` Layer.

Call `jobs.enqueue(queue, payload)` after the command's database transaction completes. Keep enqueueing independent of application SQL transactions and handle queue failures so a queue error cannot fail a note write. The starter logs failures and returns the saved note, leaving its word count pending when enqueueing fails.

After the worker writes, call `invalidateOnCommit` with the contract's invalidation keys; PostgreSQL delivers the hint to the server and the mounted live subscription refetches the query.

## Deploy

Railway's native GitHub push deploys own the rollout. Web's pre-deploy command migrates the schema and records `RAILWAY_GIT_COMMIT_SHA` as the database release. The old worker stops fetching, finishes its active jobs, and steps aside; the new worker waits for its release marker and for old workers to drain before fetching. Background jobs pause for about a minute while web keeps serving. The old web can serve for a few seconds against the migrated schema, so migrations must tolerate that edge. The worker must deploy from every push: do not use watch paths that can skip its deployment, because a skipped worker stays paused.

The starter reads the release through Effect Config; without `RAILWAY_GIT_COMMIT_SHA`, local startup records no release. Workers refresh their typed heartbeat rows every second, including while draining. A heartbeat older than five polling intervals (five seconds by default) no longer blocks takeover after a crash. Clean shutdown and completed drain delete the worker's row. `CountWords` expires after 60 seconds, pg-boss's graceful stop timeout is 65 seconds, and Railway's worker `deploy.drainingSeconds` is 75 seconds, leaving a margin before Railway kills the process.

Enable Railway's per-service tracing setting separately for the web and worker services to supply the standard OpenTelemetry exporter variables. Both export their Effect spans through Effect's OTLP/HTTP tracer, as protobuf by default or JSON with `OTEL_EXPORTER_OTLP_PROTOCOL=http/json`. For another collector, set `OTEL_EXPORTER_OTLP_ENDPOINT` to its base URL (the exporter appends `/v1/traces`) or `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` to its complete traces URL, which takes precedence. Set `OTEL_EXPORTER_OTLP_HEADERS` to comma-separated `key=value` headers with URL-encoded values, `OTEL_SERVICE_NAME` to the service identity, and optional `OTEL_RESOURCE_ATTRIBUTES` to comma-separated resource attributes. Without an endpoint, no exporter runs. eBPF auto-instrumentation is not part of the framework path.

### Railway with PostgreSQL

1. Push the generated repository to GitHub. Install the [Railway CLI](https://docs.railway.com/guides/cli) (5.42.1 or newer), run `railway login`, and create an empty project with `railway init` or link an empty project with `railway link`. Run these commands from the generated app's root, after `pnpm run setup` has installed its pinned `railway` TypeScript SDK.
2. In the Railway dashboard, add an empty service named `web`, keeping its source disconnected. Generate its public domain in Networking settings. In the selected environment's shared variables, create `BETTER_AUTH_SECRET` with the output of `openssl rand -base64 32` and `PUBLIC_URL` with that full HTTPS URL. Create both shared values before the first plan/apply; web references them through `ctx.shared` in the configuration.
3. Run `railway config plan`. The CLI evaluates `.railway/railway.ts`, reuses `web`, and previews a `Postgres` database and `worker` service. Review that plan, then run `railway config apply` and confirm it. The configuration uses the linked project's name, connects both services' `DATABASE_URL` to `Postgres`, and gives web references to the shared authentication secret and public URL. It sets `HOST=0.0.0.0`, `AUTH_CLIENT_IP_HEADER=x-real-ip` and `TRUSTED_PROXY=100.64.0.0/10` on `web`; Railway supplies `PORT`. The worker needs no public domain. Keep PostgreSQL's persistent volume and credentials in Railway.
4. Connect both services to the GitHub repository in their source settings, keeping the service root at the repository root, then deploy both. Railpack installs dependencies and runs `pnpm build`. Web runs `pnpm migrate` in its pre-deploy container to apply the numbered notes and Better Auth migrations and install or upgrade the registered pg-boss schema component. A failed migration stops the new web deployment while the old version keeps serving. Neither service migrates at boot. The worker uses migration mode `"wait"` until the ledger and pg-boss component are current, since Railway may start the services in any order. The web service starts `pnpm start`, and Railway checks `GET /health` with a 120-second timeout before routing traffic. The worker starts `pnpm worker` without an HTTP health check.
5. Open the application domain, sign up and create a note. Confirm the word count appears, then sign out and back in to check the saved note. Change the secret or public URL in the environment's shared variables and redeploy web when either changes. Keep these values in shared variables rather than service-specific overrides; later plan/apply runs retain the references without putting the values in source.

After editing `.railway/railway.ts`, run `railway config plan` and `railway config apply` again. Railway deploys do not apply the TypeScript file automatically. Keep the file as the complete configuration for this project's environment; review any resource deletions in the plan before applying. See [Railway Infrastructure as Code](https://docs.railway.com/infrastructure-as-code) for the CLI workflow.

The server and worker use the same PostgreSQL database. Local `pnpm db:setup` is for development and must not run against the hosted database.

### Server environment

The worker and `pnpm migrate` need only `DATABASE_URL`, shared with web. Set these variables on web:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Your PostgreSQL connection URL. |
| `BETTER_AUTH_SECRET` | A random secret of at least 32 characters, kept in the host's secret settings. |
| `PUBLIC_URL` | Your public app URL, such as `https://app.example`. Its origin configures Better Auth's base URL, trusted origins and RPC session Origin policy. HTTPS enables secure cookies. Leave it unset for loopback HTTP development. |
| `PORT` | The port supplied by your host; defaults to `3000`. |
| `MAX_BODY_SIZE` | Maximum RPC request body size in bytes; defaults to `1048576` (1 MiB). |
| `HOST` | `0.0.0.0` to listen on the container's network interface; defaults to loopback. |
| `AUTH_CLIENT_IP_HEADER` | The forwarded client-IP header Better Auth reads from trusted proxy peers; defaults to `x-forwarded-for`. |
| `TRUSTED_PROXY` | A comma-separated list of proxy peer addresses or CIDR ranges, such as `10.0.0.0/24,2001:db8::/32`. IPv4, IPv6 and IPv4-mapped IPv6 peers are supported. The same peer matching controls forwarded RPC authority and Better Auth client IPs for rate limiting. Without it, the RPC guard retains its loopback default and auth ignores forwarded IP headers, using the connection peer address for separate rate-limit buckets without Better Auth's missing-IP warning. A session host bound to a non-loopback `HOST` logs a startup warning naming `TRUSTED_PROXY` and `config.trustedProxy`, because forwarded RPC will be refused. Loopback hosts and the `loopback` policy do not warn. |

For Railway, the starter sets `AUTH_CLIENT_IP_HEADER=x-real-ip` with `TRUSTED_PROXY=100.64.0.0/10` because Railway's edge sets `X-Real-IP` to the client address; see [Railway's networking specs](https://docs.railway.com/networking/public-networking/specs-and-limits). The CIDR is the observed source range of its edge proxy. Railway does not promise this range, and it also trusts other services in the same Railway project. A matching proxy peer must forward `X-Forwarded-Host` and `X-Forwarded-Proto` (`http` or `https`) for the public URL; any browser `Origin` must match that authority. With the default `AUTH_CLIENT_IP_HEADER=x-forwarded-for`, the proxy must overwrite `X-Forwarded-For` with the client IP or append the actual client IP to the incoming chain; Better Auth resolves the first untrusted address from the right, skipping the configured trusted hops. Auth ignores forwarded client-IP headers from peers outside `TRUSTED_PROXY`.

### Database connection security

A deployed app opens three separate PostgreSQL connection paths from `DATABASE_URL`: the Effect SQL pool built by `appHost` (`databaseLayer.ts`, using the native `@effect/sql-pg` driver over a custom stream), Better Auth's `pg` Pool (`authDatabase` in `better-auth/mount.ts`), and pg-boss's `pg` Pool (`connectionString` in jobs). Without `sslmode`, all three connect in plaintext even when PostgreSQL offers TLS, under the starter's default configuration. HTTPS on the web service does not encrypt these database connections.

Plaintext PostgreSQL is acceptable inside a private network such as Railway's: [Railway documents](https://docs.railway.com/networking/private-networking) that inter-service traffic stays off the public internet, uses encrypted WireGuard tunnels, and is isolated per environment. Use its private database address for that protection. Elsewhere, add `sslmode=require` or `sslmode=verify-full` to `DATABASE_URL` on every service, including migrations and workers:

```sh
DATABASE_URL=postgresql://user:password@db.example/app?sslmode=verify-full
```

These drivers do not follow all libpq SSL-mode semantics. The catalog versions of `@effect/sql-pg`, and of `pg` with its `pg-connection-string` parser, behave as follows with their default settings:

| Driver | `sslmode` behavior |
| --- | --- |
| Native `@effect/sql-pg` | Accepts `disable`, `allow`, `prefer`, `require`, `verify-ca` and `verify-full`. `disable` uses plaintext. `allow` and `prefer` try TLS first and fall back to plaintext only when the server refuses TLS. `require`, `verify-ca` and `verify-full` require TLS and verify the certificate. Unknown values, including `no-verify`, fail configuration. The custom stream does not bypass TLS negotiation. |
| `pg` (Better Auth and pg-boss) | `disable` uses plaintext. `prefer`, `require` and `verify-ca` are aliases for `verify-full`: they require TLS and verify the certificate, without plaintext fallback. `no-verify` requires TLS but disables certificate verification. The parser does not reject unknown mode strings; `allow` has no special handling and enables verified TLS without fallback. |

Both drivers verify the server certificate for `require`, unlike libpq's usual `require` behavior. `pg` can opt into different libpq-compatible semantics with `uselibpqcompat=true`; the starter does not set it. Prefer `verify-full` to make the intended policy explicit. A server without TLS makes app-host database startup and jobs Layer startup fail; Better Auth's pool fails when it first queries.

For a private certificate authority, set `NODE_EXTRA_CA_CERTS=/path/to/ca.pem` before starting each Node process. The native driver ignores the URL's `sslrootcert`, although `pg` reads it; `NODE_EXTRA_CA_CERTS` supplies trust to both drivers. Keep certificate verification enabled.

### Health and migrations

Use `GET /health` for the web service healthcheck. It queries PostgreSQL on each request, returns `200` only when the query succeeds within two seconds, and returns `503` when the database is unavailable or the probe times out. Both responses have an empty body, require no authentication and disable caching. Better Auth’s `/api/auth/ok` only checks the auth process.

Web’s pre-deploy step owns migrations. The `.railway/railway.ts` web configuration sets `preDeploy: "pnpm migrate"` to run migrations in a separate pre-deploy container before the new web version starts. A failed migration exits nonzero and stops that deployment; Railway keeps the previous version serving. The migration list registers `pgBossSchema()` alongside the numbered loader. The command installs or upgrades pg-boss after the ledger transaction commits; web and worker start their jobs Layers with `migrate: false` and register their queues at startup. The migration command needs only `DATABASE_URL`, and rerunning it preserves applied migrations and application rows.

Neither web nor worker runs migrations at boot. Web uses `migrations.mode: "check"` after its pre-deploy migration command to require the numbered migrations in its loader and the pg-boss component to be current before initializing authentication or HTTP. This prevents web from initializing Better Auth while its `user`, `session`, `account` and `verification` tables are still missing. Every service without that pre-deploy command uses `migrations.mode: "wait"`; the starter worker waits for the shared ledger and pg-boss component before initializing jobs, because deploy platforms may start services in any order. It polls every second and fails with the schema check’s `MigrationError` once its five-minute polling budget is exceeded while still behind. Configure `migrations.pollInterval` and `migrations.waitTimeout` in `databaseOptions` when the deployment needs different durations. For local production runs, run `pnpm migrate` before `pnpm start` or `pnpm worker`; `pnpm dev` performs this step before starting watchers.

If the worker’s first check finds pending work, the host logs `Waiting for database migrations`, then `Still waiting for database migrations` every 30 seconds independently of polling. Both carry `pendingMigrations` (ID and name) and `pendingComponents` (name and detail) annotations. Configure `migrations.progressInterval` with an Effect duration input to change this interval. The host logs `Database migrations current` once when a later check passes, or `Timed out waiting for database migrations` with the pending annotations before failing. An already current schema emits none of these host lines. The worker logs `Worker ready to take jobs` after its jobs Layer starts; release drain coordination can still hold fetching paused. These lines use Effect’s logger and include no connection details or secrets.

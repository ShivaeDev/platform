# Start a Platform app

Use Node 24 or newer and pnpm 12.8.1. The [starter](../../examples/starter) is a private notes app with PostgreSQL, Platform's app host, RPC, shared query state, routing, a form, Vite, React and Tailwind with shadcn-style components.

1. Run `pnpm create @shivaedev/app my-app`, then `cd my-app`. The command writes the starter with exact published Platform versions, keeps its self-contained pnpm catalog, installs dependencies, and generates a git-ignored `.env.local` with a fresh authentication secret and `my_app_dev`/`my_app_test` database URLs. Use an absent or empty folder; existing files are never overwritten.
2. Run `pnpm dev` and open `http://127.0.0.1:5173`. It first runs `pnpm db:setup` to prepare both databases through `@shivaedev/local-postgres`; have local PostgreSQL 18.6 on port 55432 or Docker available. It then runs `pnpm migrate` to apply the shared schema, including Better Auth’s tables. The server and background worker watch TypeScript, and Vite serves React. Follow the sign-in link, create an account, then add a note. The worker counts each note's words; the count appears without refreshing. Sign out and sign back in to see your saved notes.

Run `pnpm test` to load `TEST_DATABASE_URL` from `.env.local` and test the app against its dedicated local test database. Run `pnpm db:setup` separately when you want to prepare databases without starting development. See [local-postgres machine setup](../../packages/local-postgres/README.md#install-and-machine-setup) for the shared local service requirements.

To try it inside this repository, first run `./script/update` at the root, then copy `.env.example` to `.env.local` inside `examples/starter`, replace `BETTER_AUTH_SECRET` with the output of `openssl rand -base64 32`, and run `pnpm dev`. Keep the `workspace:*` dependencies for repository development.

In your generated app's Git repository, run `pnpm exec quality hooks install` once to install the pre-commit gate. Run `pnpm lint` to check the shared Quality policy and `pnpm format` to apply its fixes and formatting. The starter's `biome.json` extends `@shivaedev/quality/biome`; no Quality config or baseline is needed.

To verify the generated app against published packages, run `pnpm --filter @shivaedev/starter check:published` at the root. The command creates temporary folders outside the workspace, installs the exact npm versions in `published-versions.json`, checks framework README imports, packs and installs `@shivaedev/create-app`, generates an app, then runs that app's Quality lint, typecheck, Vite build and PostgreSQL/authenticated HTTP round-trip tests. It uses the shared local test database prepared by `./script/update`; set `TEST_DATABASE_URL` to use another dedicated PostgreSQL database whose role can create disposable databases. Missing database access fails the check. Temporary copies are removed on completion or failure.

For changes awaiting a framework release, `pnpm ready` runs the same documentation and generated-app checks with verified workspace archives, adding tarball overrides only to the temporary consumers. Registry mode remains the release check against the pinned npm versions.

The starter uses effect-pg-boss's published `clientFactory` option to create its producer queues before serving requests, with an empty `jobs` list so the host starts no consumer. The separate worker registers the handler. The published-version check includes their PostgreSQL/live-update round trip.

Change the shared operations in `src/notes.ts`, the table and services in `src/server`, and the screen in `src/client`. The CSS declaration is local; no `vite/client` types are needed. `pnpm build && pnpm migrate && pnpm start` serves the built app on port 3000; run `pnpm worker` in a second process to handle jobs.

The notes route loads an authenticated RPC query; the create command is also protected. Missing or revoked sessions return typed `Unauthorized` failures that the UI presents as a sign-in prompt. Each account sees its own notes. `SessionBoundary` replaces the query registry and drafts when the session changes. Better Auth's HTTP endpoints share the app host at `/api/auth/*`; Vite proxies both auth and RPC to that host during development.

The starter uses strict application checking with `skipLibCheck: true`, matching Quality's application configuration. Better Auth's published declarations also reference runtimes this Node app does not use. Auth setup is local to `src/server/makeAuth.ts`; `src/server/migrations.ts` calls Better Auth's [programmatic migration API](https://better-auth.com/docs/concepts/database#programmatic-migrations), so no separate auth CLI step is needed. With `PUBLIC_URL` unset, auth supports the documented `127.0.0.1` HTTP development and built-app URLs.

## Add a job

Define a payload Schema with `defineQueue` in `src/server/noteJobs.ts`, prepare its producer queue in `src/server/noteProducer.ts`, and register its handler in `src/server/noteWorker.ts`. The migration command prepares job storage and queues; the worker uses the host’s `appDatabase` Layer in check mode.
Enqueue from a command inside `transact`, passing `{ db: yield* jobDatabase }` so the queue insert commits or rolls back with the command.
After the worker writes, call `invalidateOnCommit` with the contract's invalidation keys; PostgreSQL delivers the hint to the server and the mounted live subscription refetches the query.

## Deploy

Build with `pnpm build`, run `pnpm migrate` as the web service’s pre-deploy command, then start web with `pnpm start` and a separate worker service with `pnpm worker`. Both connect to the same PostgreSQL database. The worker requires only `DATABASE_URL`; it does not use `BETTER_AUTH_SECRET`, `PUBLIC_URL` or HTTP settings. Set these variables on the web service:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Your PostgreSQL connection URL. |
| `BETTER_AUTH_SECRET` | A random secret of at least 32 characters, kept in the host's secret settings. |
| `PUBLIC_URL` | Your public app URL, such as `https://app.example`. Its origin configures Better Auth's base URL, trusted origins and RPC session Origin policy. HTTPS enables secure cookies. Leave it unset for loopback HTTP development. |
| `PORT` | The port supplied by your host; defaults to `3000`. |
| `MAX_BODY_SIZE` | Maximum RPC request body size in bytes; defaults to `1048576` (1 MiB). |
| `HOST` | `0.0.0.0` to listen on the container's network interface; defaults to loopback. |
| `TRUSTED_PROXY` | A comma-separated list of proxy peer addresses or CIDR ranges, such as `10.0.0.0/24,2001:db8::/32`. IPv4, IPv6 and IPv4-mapped IPv6 peers are supported. Without it, the RPC guard retains its loopback default. |

For Railway, use `TRUSTED_PROXY=100.64.0.0/10`, the observed source range of its edge proxy. Railway does not promise this range, and it also trusts other services in the same Railway project; see [Railway's networking specs](https://docs.railway.com/networking/public-networking/specs-and-limits). A matching proxy peer must forward `X-Forwarded-Host` and `X-Forwarded-Proto` (`http` or `https`) for the public URL; any browser `Origin` must match that authority.

Use `GET /health` for the web service healthcheck. It queries PostgreSQL on each request, returns `200` only when the query succeeds within two seconds, and returns `503` when the database is unavailable or the probe times out. Both responses have an empty body, require no authentication and disable caching. Better Auth’s `/api/auth/ok` only checks the auth process.

On Railway, the starter’s `railway.toml` configures the web build, start command and `/health` check. Create a second service from the same repository for the worker and set its config file path to `/railway.worker.toml`; that service has no HTTP healthcheck. Set its `DATABASE_URL` to the same database as the web service.

Web’s pre-deploy step owns migrations. The `railway.toml` web configuration runs `pnpm migrate` in a separate pre-deploy container before the new web version starts. A failed migration exits nonzero and stops that deployment; Railway keeps the previous version serving. The command also prepares pg-boss storage and producer queues; web and worker disable pg-boss’s schema migration at boot. The migration command needs only `DATABASE_URL`, and rerunning it preserves applied migrations and application rows.

Neither web nor worker runs migrations at boot. Both use `migrations.mode: "check"` to require the numbered migrations in their loader to be recorded in the shared ledger before initializing authentication, HTTP or jobs. A worker started before pre-deploy finishes exits with a schema-not-current error; Railway’s restart policy starts it again until the schema is current. For local production runs, run `pnpm migrate` before `pnpm start` or `pnpm worker`; `pnpm dev` performs this step before starting watchers.

The worker logs `Worker migrations applied` after confirming that its required migrations are recorded, then `Worker ready to take jobs` after pg-boss registers its handlers. Both lines use Effect’s logger and include no connection details or secrets.

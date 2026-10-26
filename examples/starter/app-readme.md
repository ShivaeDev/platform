# {{appName}}

A notes application built on the ShivaeDev framework, with PostgreSQL persistence, authenticated RPC, React forms and a background word-count worker. Each account sees its own notes.

```tsx
const query = useQuery(client.api.list.query());
```

The shared contract lives in `src/modules/notes/notes.ts`, server code in `src/server`, and the browser entry point in `src/client/entry.tsx`. The application owns its UI and session policy; Effect services, transactions and native RPC connect the layers.

To remove the example, delete `src/modules/notes` and its import and entry in `src/server/modules.ts`, `src/server/workerModules.ts`, `src/client/modules.ts` and `src/server/migrations.ts`, then run `pnpm ready`. Add your app's first module under `src/modules` and register its server, worker, client and migration pieces in those same registries.

## Develop and test

Use Node 24 or newer and pnpm. After cloning, run:

```sh
pnpm run setup
pnpm dev
```

Setup installs dependencies and Quality's pre-commit hook when this app has its own Git repository. Development first prepares the development and test databases, then starts the server, worker and Vite. Open `http://127.0.0.1:5173`, create an account and add a note.

The git-ignored `.env.local` contains local database URLs and an authentication secret. On a new checkout, copy `.env.example` to `.env.local` and replace `BETTER_AUTH_SECRET` with the output of `openssl rand -base64 32`. Have PostgreSQL 18.6 on loopback port 55432 or Docker available; `pnpm db:setup` prepares both databases without starting development.

```sh
pnpm test
pnpm ready
```

Tests load `TEST_DATABASE_URL` from `.env.local`. Use a dedicated database whose role can create disposable databases. The foundation’s story kits live in `src/test-support`; the notes module’s kits live in `src/modules/notes/test-support` and cover its PostgreSQL, HTTP, schema and happy-dom behavior. Extend those kits for new features. `pnpm ready` runs the same peer, lint, typecheck, build and test commands as `.github/workflows/ci.yml`. Use `pnpm lint` to check the code and `pnpm format` to apply formatting and fixes.

The Quality baseline only goes down. Use `pnpm baseline write --rule <id>` only to record findings for a new rule added by a Quality upgrade. After fixing findings in changed files, run `pnpm baseline tighten`; use `pnpm baseline prune` to lower every entry across the app. Never raise a baseline to make a check pass.

With a clean Git working tree, run `pnpm dlx @shivaedev/create-app@latest update` from this app to merge later template changes while preserving your edits and deleted files. Review the changes and any listed Git conflicts, run `pnpm install`, and commit them yourself; `.create-app.json` records the generator version after a successful merge.

## Build and deploy

```sh
pnpm build
pnpm migrate
pnpm start
```

The built server serves the UI, authentication and RPC on port 3000 by default. Run `pnpm worker` as a separate process for background jobs. Set `DATABASE_URL` on both processes; the worker and `pnpm migrate` need only this variable. On web, also set a random `BETTER_AUTH_SECRET` of at least 32 characters and `PUBLIC_URL` to your public app URL. For web in a container, use `HOST=0.0.0.0` and the host's `PORT`; configure `TRUSTED_PROXY` for your proxy's peer addresses or CIDR ranges.

## Inspect background jobs

Open `/admin` or `/admin/jobs` on the app host (port 3000 locally, or through Vite on port 5173) for health, queue counts, paginated failed and dead-lettered jobs, and job detail. These app-owned views register native contracts with [`@shivaedev/admin`](https://github.com/ShivaeDev/platform/tree/main/packages/admin) and use the existing `/rpc` transport and session-owned atoms. Vite serves the React routes and proxies their RPC calls to the app host. The default Jobs registration is read-only. `/admin/notes` is an example app page with note statistics across all users. Both pages require the `admin` role; `owner` alone stays forbidden.

After `pnpm migrate`, create an admin with a new email address:

```sh
ADMIN_EMAIL=operator@example.com ADMIN_PASSWORD='a-long-unique-password' pnpm admin:create
```

The command uses the server's `DATABASE_URL` and `BETTER_AUTH_SECRET`; `ADMIN_NAME` defaults to `Administrator`. It fails if the email already exists. Sign in with those credentials, then visit `/admin/jobs`.

To add a page, follow the note-statistics example: author an `adminPage` contract, include it in the registry, supply its server handlers and add its React route. Views live outside the stock shadcn folder and upgrade through create-app's three-way updater. Retry is opt-in: register `jobsPageWithRetry` and `jobsHandlersWithRetry`, bind that contract, and pass a runtime action for `retry.run` to `JobsView`.

## Deployment services

Railway's native GitHub push deploys own the rollout. Web's pre-deploy command migrates the schema and records `RAILWAY_GIT_COMMIT_SHA` as the database release. The old worker stops fetching, finishes its active jobs, and steps aside; the new worker waits for its release marker and for old workers to drain before fetching. Background jobs pause for about a minute while web keeps serving. The old web can serve for a few seconds against the migrated schema, so migrations must tolerate that edge. The worker must deploy from every push: do not use watch paths that can skip its deployment, because a skipped worker stays paused.

The app reads the release through Effect Config; without `RAILWAY_GIT_COMMIT_SHA`, local startup behaves as before. Workers refresh their typed heartbeat rows every second, including while draining. A heartbeat older than five polling intervals (five seconds by default) no longer blocks takeover after a crash. Clean shutdown and completed drain delete the worker's row. `CountWords` expires after 60 seconds, pg-boss's graceful stop timeout is 65 seconds, and Railway's worker `deploy.drainingSeconds` is 75 seconds, leaving a margin before Railway kills the process.

To export Effect spans from both services, set `OTEL_EXPORTER_OTLP_ENDPOINT` or the complete `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`, plus `OTEL_SERVICE_NAME`. Configure collector authentication with `OTEL_EXPORTER_OTLP_HEADERS`, using comma-separated `key=value` pairs with URL-encoded values. Railway's tracing setting supplies the endpoint and metadata. With no endpoint, no exporter runs.

For Railway, install its CLI, link an empty project and follow the [deployment guide](https://github.com/ShivaeDev/platform/blob/main/docs/framework/quickstart.md#deploy). Set the shared authentication secret and public URL for web before running `railway config plan` and `railway config apply`. The configuration in `.railway/railway.ts` defines PostgreSQL, web and worker services. Both services build. Web runs `pnpm migrate` in its pre-deploy container, then starts HTTP with `pnpm start`; Railway checks `/health`. Neither process migrates at boot. Web uses migration mode `"check"` after pre-deploy. The worker starts `pnpm worker` with migration mode `"wait"` until the schema is current. Every service without the pre-deploy migration command uses `"wait"`, because deploy platforms may start services in any order.

Read the [framework docs](https://github.com/ShivaeDev/platform/blob/main/docs/framework/README.md) for design boundaries and the [quickstart](https://github.com/ShivaeDev/platform/blob/main/docs/framework/quickstart.md) for local database and hosting details.

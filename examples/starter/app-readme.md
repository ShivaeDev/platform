# {{appName}}

A notes application built on the ShivaeDev framework, with PostgreSQL persistence, authenticated RPC, React forms and a background word-count worker. Each account sees its own notes.

```tsx
const query = useQuery(client.api.list.query());
```

The shared contract lives in `src/modules/notes/notes.ts`, server code in `src/server`, and the browser entry point in `src/client/entry.tsx`. The application owns its UI and session policy; Effect services, transactions and native RPC connect the layers.

To remove the example, delete `src/modules/notes` and its import and entry in `src/server/modules.ts`, `src/server/workerModules.ts` and `src/client/modules.ts`, then run `pnpm ready`. Add your app's first module under `src/modules` and register its server, worker and client pieces in those same registries.

Server registrations carry `{ migrations, group, handlers, services }`. Set `migrations` to the module’s migration directory; the foundation derives its migration list from registered modules.

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

Tests load `TEST_DATABASE_URL` from `.env.local`. Use a dedicated database whose role can create disposable databases. The foundation’s story kits live in `src/test-support`; the notes module’s kits live in `src/modules/notes/test-support` and cover its PostgreSQL, HTTP, schema and happy-dom behavior. Extend those kits for new features. Pass a `replacements` Layer to `applicationHost` or `applicationWorker` to supply fake services over the real ones, for example `Layer.succeed(JobsClientFactory, testing.clientFactory)` for the queue client factory. `pnpm ready` runs the same peer, lint, typecheck, build and test commands as `.github/workflows/ci.yml`. Use `pnpm lint` to check the code and `pnpm format` to apply formatting and fixes.

The app depends on [`@shivaedev/platform`](https://github.com/ShivaeDev/platform/tree/main/packages/platform#readme), which brings every runtime piece of the framework, and on `@shivaedev/test-story` and `@shivaedev/quality` for development. Import each piece by its own name, such as `@shivaedev/sql/repository.ts`, without listing it in `package.json`; `publicHoistPattern` in `pnpm-workspace.yaml` makes the pieces resolvable, and `pnpm lint` rejects a piece listed beside the entry point that brings it.

The Quality baseline only goes down. Use `pnpm baseline write --rule <id>` only to record findings for a new rule added by a Quality upgrade. After fixing findings in changed files, run `pnpm baseline tighten`; use `pnpm baseline prune` to lower every entry across the app. Never raise a baseline to make a check pass.

With a clean Git working tree, run `pnpm dlx @shivaedev/create-app@latest update` from this app to merge later template changes while preserving your edits and deleted files. Review the changes and any listed Git conflicts, run `pnpm install`, and commit them yourself; `.create-app.json` records the generator version after a successful merge.

## Build and deploy

```sh
pnpm build
pnpm migrate
pnpm start
```

The built server serves the UI, authentication and RPC on port 3000 by default. Run `pnpm worker` as a separate process for background jobs. Set `DATABASE_URL` on both processes; the worker and `pnpm migrate` need only this variable. On web, also set a random `BETTER_AUTH_SECRET` of at least 32 characters and `PUBLIC_URL` to your public app URL. For web in a container, use `HOST=0.0.0.0` and the host's `PORT`; configure `TRUSTED_PROXY` for your proxy's peer addresses or CIDR ranges.

`.railway/railway.ts` defines the PostgreSQL, web and worker services for Railway. The [deployment guide](https://github.com/ShivaeDev/platform/blob/main/docs/framework/quickstart.md#deploy) explains the rollout and worker drain, trace export, Railway setup, the server environment, database connection security, health checks and migration modes; follow it before the first deploy and after each change to `.railway/railway.ts`. The [framework docs](https://github.com/ShivaeDev/platform/blob/main/docs/framework/README.md) explain the design boundaries.

## Administer the app

Open `/admin` or `/admin/jobs` on the app host (port 3000 locally, or through Vite on port 5173) for health, queue counts, paginated failed and dead-lettered jobs, and job detail. These app-owned views register native contracts with [`@shivaedev/admin`](https://github.com/ShivaeDev/platform/tree/main/packages/admin) and use the existing `/rpc` transport and session-owned atoms. Vite serves the React routes and proxies their RPC calls to the app host. The default Jobs registration is read-only. `/admin/notes` is an example app page with note statistics across all users. The pages require `jobs.read` and `notes.statistics.read`; client routes use the same grants with one permission fallback.

After `pnpm migrate`, create an owner with a new email address:

```sh
ADMIN_EMAIL=operator@example.com ADMIN_PASSWORD='a-long-unique-password' pnpm admin:create
```

The command uses the server's `DATABASE_URL` and `BETTER_AUTH_SECRET`; `ADMIN_NAME` defaults to `Administrator`. It fails if the email already exists. Sign in with those credentials, then visit `/admin/jobs`.

To add a page, follow the note-statistics example: author an `adminPage` contract, include it in the registry, supply its server handlers and add its React route. Views live outside the stock shadcn folder and upgrade through create-app's three-way updater. Retry is opt-in: register `jobsPageWithRetry` and `jobsHandlersWithRetry`, bind that contract, and pass a runtime action for `retry.run` to `JobsView`.

`/admin/users` lists names, email addresses, roles and sign-up times for callers with `users.read`. Callers with `roles.assign` choose each user's single role from the code-defined role set; the server refuses to remove its final role assigner. The bootstrap command creates an `owner` with all admin domain permissions. Existing apps receive the route wiring through the create-app updater; migrate stored comma-separated roles to one declared role string before starting the new app. Role changes emit actor and timestamp logs through Effect and invalidate the user list after commit. This app disables Better Auth's browser endpoints for setting roles, updating users and creating users so role writes use the guarded native contract; the server-side bootstrap API remains available.

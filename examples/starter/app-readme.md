# {{appName}}

A notes application built on the ShivaeDev framework, with PostgreSQL persistence, authenticated RPC, React forms and a background word-count worker. Each account sees its own notes.

```tsx
const query = useQuery(client.api.list.query());
```

The shared contract lives in `src/notes.ts`, server code in `src/server`, and the browser entry point in `src/client/entry.tsx`. The application owns its UI and session policy; Effect services, transactions and native RPC connect the layers.

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

Tests load `TEST_DATABASE_URL` from `.env.local`. Use a dedicated database whose role can create disposable databases. The story kits in `src/test-support` cover real PostgreSQL and HTTP, schema upgrades, and happy-dom screen behavior. Extend those kits for new features. `pnpm ready` runs the same lint, typecheck, build and test commands as `.github/workflows/ci.yml`. Use `pnpm lint` to check the code and `pnpm format` to apply formatting and fixes.

## Build and deploy

```sh
pnpm build
pnpm migrate
pnpm start
```

The built server serves the UI, authentication and RPC on port 3000 by default. Run `pnpm worker` as a separate process for background jobs. Set `DATABASE_URL`, a random `BETTER_AUTH_SECRET` of at least 32 characters, and `PUBLIC_URL` on both processes. Use `HOST=0.0.0.0` for a container and the host's `PORT`; configure `TRUSTED_PROXY` for your proxy's peer addresses or CIDR ranges.

For Railway, install its CLI, link an empty project and follow the [deployment guide](https://github.com/ShivaeDev/platform/blob/main/docs/framework/quickstart.md#deploy). Set the shared authentication secret and public URL before running `railway config plan` and `railway config apply`. The configuration in `.railway/railway.ts` defines PostgreSQL, web and worker services. Both services build and run migrations before deployment; the web service checks `/health` and starts HTTP, while the worker runs jobs.

Read the [framework docs](https://github.com/ShivaeDev/platform/blob/main/docs/framework/README.md) for design boundaries and the [quickstart](https://github.com/ShivaeDev/platform/blob/main/docs/framework/quickstart.md) for local database and hosting details.

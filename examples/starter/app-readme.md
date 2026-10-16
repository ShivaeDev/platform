# __APP_NAME__

A ShivaeDev app with authenticated notes, PostgreSQL persistence, typed RPC and React forms. Each account can create, edit and delete its own notes.

## Setup and development

Use Node 24 or newer and pnpm. Dependencies are installed when the app is created; run `pnpm install` after changing dependencies or checking out the app elsewhere.

The git-ignored `.env.local` contains development and test database URLs and a fresh authentication secret. On another checkout, copy `.env.example` to `.env.local` and replace `BETTER_AUTH_SECRET` with the output of `openssl rand -base64 32`.

```sh
pnpm db:setup
pnpm dev
```

Database setup prepares both local databases through `@shivaedev/local-postgres`. Have PostgreSQL 18.6 on loopback port 55432 or local Docker available. `pnpm dev` also runs database setup before starting the app at `http://127.0.0.1:5173`.

Server entry points live in `src/server`, the shared contract is `src/notes.ts`, and the browser starts in `src/client/entry.tsx`. See the [ShivaeDev framework docs](https://github.com/ShivaeDev/platform/blob/main/docs/framework/README.md) for architecture and package APIs.

## Checks and tests

```sh
pnpm lint
pnpm typecheck
pnpm test
```

`pnpm format` applies formatting and lint fixes. Tests load `.env.local` and cover React screens, PostgreSQL and authenticated HTTP, and migration upgrades. Set `TEST_DATABASE_URL` to a dedicated PostgreSQL database whose role can create databases; tests use disposable clones. Missing database configuration fails the database tests.

Extend the story kits in `src/test-support/application.ts`, `screens.ts` and `migration.ts` when adding behavior. Keep database and HTTP proof in application stories and focused UI behavior in happy-dom stories.

## Build and deploy

```sh
pnpm build
pnpm start
pnpm worker
```

`pnpm start` serves the built UI, authentication and RPC together at `http://127.0.0.1:3000`. Run `pnpm worker` as a separate process to handle note word-count jobs. The numbered migrations prepare application and authentication tables when the server starts.

Set `DATABASE_URL` and a random `BETTER_AUTH_SECRET` of at least 32 characters in `.env.local` or the hosting environment. Set `PUBLIC_URL` to the public app URL behind a proxy. Follow the [deployment guide](https://github.com/ShivaeDev/platform/blob/main/docs/framework/quickstart.md#deploy) for proxy settings and production operation.

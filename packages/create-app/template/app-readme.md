# __APP_NAME__

An Effect application on the ShivaeDev framework, with PostgreSQL, authenticated RPC and a React notes workflow. Application code lives in `src/server` and `src/client`; the shared contract is `src/notes.ts`.

## Setup and development

Use Node 24 or newer and pnpm. Dependencies are installed during creation. After cloning the app, run `pnpm install`; if `.env.local` is absent, copy `.env.example` to `.env.local` and replace the example authentication secret with `openssl rand -base64 32`.

```sh
pnpm dev
```

Open `http://127.0.0.1:5173`. Development first runs `pnpm db:setup` to prepare both local databases. Have PostgreSQL 18.6 on loopback port 55432 or Docker available; see [local PostgreSQL setup](https://github.com/ShivaeDev/platform/tree/main/packages/local-postgres#install-and-machine-setup). Run `pnpm db:setup` separately when needed.

## Checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`pnpm format` applies formatting. Tests load `.env.local` and use `TEST_DATABASE_URL` for real PostgreSQL and HTTP tests alongside happy-dom React tests. Use a dedicated test database whose role can create disposable database clones. Missing database configuration fails the tests.

## Deploy

```sh
pnpm build
pnpm start
```

The server serves the built UI, authentication endpoints and RPC at `http://127.0.0.1:3000`. Set `DATABASE_URL` to your production PostgreSQL database and `BETTER_AUTH_SECRET` to at least 32 random characters. Run `pnpm worker` as a separate process for background jobs. Migrations run through the application host, including the authentication tables.

Behind a proxy, set `PUBLIC_URL` to the public app URL and follow the [deployment guide](https://github.com/ShivaeDev/platform/blob/main/docs/framework/quickstart.md#deploy). See the [framework documentation](https://github.com/ShivaeDev/platform/blob/main/docs/framework/README.md) for the services, persistence, RPC and React conventions used here.

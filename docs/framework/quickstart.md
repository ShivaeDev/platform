# Start a Platform app

Use Node 24 or newer and pnpm 12.8.1. The [starter](../../examples/starter) is a private notes app with PostgreSQL, Platform's app host, RPC, shared query state, routing, a form, Vite, React and Tailwind with shadcn-style components.

1. Copy `examples/starter` to your app folder, leaving out `node_modules`, `dist` and `.env.local`.
2. Rename the `name` in `package.json`. Outside this repository, replace every `workspace:*` dependency with its latest published version, rename `pnpm-workspace.copy.yaml` to `pnpm-workspace.yaml`, then run `pnpm install`. Keep that file: its catalog pins Effect and the shared Node platform to the same version and approves the `esbuild` and `msgpackr-extract` builds.
3. Copy `.env.example` to `.env.local` and set `DATABASE_URL` to your PostgreSQL database. Set `BETTER_AUTH_SECRET` to a random secret of at least 32 characters, for example the output of `openssl rand -base64 32`.
4. Run `pnpm dev` and open `http://127.0.0.1:5173`. The server and background worker watch TypeScript, Vite serves React, and the host runs migrations, including Better Auth's tables, before serving HTTP/NDJSON RPC. Follow the sign-in link, create an account, then add a note. The worker counts each note's words; the count appears without refreshing. Sign out and sign back in to see your saved notes.

To try it inside this repository, first run `./script/update` at the root, then do steps 3 and 4 inside `examples/starter`. The example URL uses the shared local PostgreSQL that setup prepares. Keep the `workspace:*` dependencies for repository development.

An npm-only copy requires published Platform and effect-react versions containing `appHost.ts` and `router.ts`, and an effect-pg-boss version accepting producer queue definitions in `jobs`. Those APIs are currently available in the workspace; verify the published versions before copying outside it.

Change the shared operations in `src/notes.ts`, the table and services in `src/server`, and the screen in `src/client`. The CSS declaration is local; no `vite/client` types are needed. `pnpm build && pnpm start` serves the built app on port 3000; run `pnpm worker` in a second process to handle jobs.

The notes route loads an authenticated RPC query; the create command is also protected. Missing or revoked sessions return typed `Unauthorized` failures that the UI presents as a sign-in prompt. Each account sees its own notes. `SessionBoundary` replaces the query registry and drafts when the session changes. Better Auth's HTTP endpoints share the app host at `/api/auth/*`; Vite proxies both auth and RPC to that host during development.

The starter uses strict application checking with `skipLibCheck: true`, matching Quality's application configuration. Better Auth's published declarations also reference runtimes this Node app does not use. Auth setup is local to `src/server/auth.ts`; `src/server/migrations.ts` calls Better Auth's [programmatic migration API](https://better-auth.com/docs/concepts/database#programmatic-migrations), so no separate auth CLI step is needed. With `PUBLIC_URL` unset, auth supports the documented `127.0.0.1` HTTP development and built-app URLs.

## Add a job

Define a payload Schema with `defineQueue` in `src/server/noteJobs.ts`, and register its handler in `src/server/noteWorker.ts`; the worker uses the host's `appDatabase` Layer.
Enqueue from a command inside `transact`, passing `{ db: yield* jobDatabase }` so the queue insert commits or rolls back with the command.
After the worker writes, call `invalidateOnCommit` with the contract's invalidation keys; PostgreSQL delivers the hint to the server and the mounted live subscription refetches the query.

## Deploy

Set these environment variables on the server; the worker uses the same `DATABASE_URL`:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Your PostgreSQL connection URL. |
| `BETTER_AUTH_SECRET` | A random secret of at least 32 characters, kept in the host's secret settings. |
| `PUBLIC_URL` | Your public app URL, such as `https://app.example`. Its origin configures Better Auth's base URL, trusted origins and RPC session Origin policy. HTTPS enables secure cookies. Leave it unset for loopback HTTP development. |
| `PORT` | The port supplied by your host; defaults to `3000`. |
| `HOST` | `0.0.0.0` to listen on the container's network interface; defaults to loopback. |
| `TRUSTED_PROXY` | A comma-separated list of proxy peer addresses or CIDR ranges, such as `10.0.0.0/24,2001:db8::/32`. IPv4, IPv6 and IPv4-mapped IPv6 peers are supported. Without it, the RPC guard retains its loopback default. |

For Railway, use `TRUSTED_PROXY=100.64.0.0/10`, the observed source range of its edge proxy. Railway does not promise this range, and it also trusts other services in the same Railway project; see [Railway's networking specs](https://docs.railway.com/networking/public-networking/specs-and-limits). A matching proxy peer must forward `X-Forwarded-Host` and `X-Forwarded-Proto` (`http` or `https`) for the public URL; any browser `Origin` must match that authority.

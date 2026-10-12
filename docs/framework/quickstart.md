# Start a Platform app

Use Node 24 or newer and pnpm 12.8.1. The [starter](../../examples/starter) is a private notes app with PostgreSQL, Platform's app host, RPC, shared query state, routing, a form, Vite, React and Tailwind with shadcn-style components.

1. Copy `examples/starter` to your app folder, leaving out `node_modules`, `dist` and `.env.local`.
2. Rename the `name` in `package.json`. Outside this repository, replace every `workspace:*` dependency with its latest published version, rename `pnpm-workspace.copy.yaml` to `pnpm-workspace.yaml`, then run `pnpm install`. Keep that file: its catalog pins Effect and the shared Node platform to the same version and approves the `esbuild` and `msgpackr-extract` builds.
3. Copy `.env.example` to `.env.local` and set `DATABASE_URL` to your PostgreSQL database.
4. Run `pnpm dev` and open `http://127.0.0.1:5173`. The server watches TypeScript, Vite serves React, and the host runs migrations before serving HTTP/NDJSON RPC. Add a note to try the round trip.

To try it inside this repository, first run `./script/update` at the root, then do steps 3 and 4 inside `examples/starter`. The example URL uses the shared local PostgreSQL that setup prepares. Keep the `workspace:*` dependencies for repository development.

An npm-only copy requires published Platform and effect-react versions containing `appHost.ts` and `router.ts`. Those entry points are currently available in the workspace; verify the published versions before copying outside it.

Change the shared operations in `src/notes.ts`, the table and services in `src/server`, and the screen in `src/client`. The CSS declaration is local; no `vite/client` types are needed. `pnpm build && pnpm start` serves the built app on port 3000.

## Deploy

Build with `pnpm build` and run with `pnpm start`. A host such as Railway supplies `PORT`; connect its PostgreSQL service through `DATABASE_URL`. Configure your session provider's auth secret in the host's secret settings (for example, `BETTER_AUTH_SECRET` for Better Auth). The starter has anonymous sessions and does not read an auth secret; add your application's session provider before serving private data.

Set `HOST=0.0.0.0` to bind the container's network interface and `TRUSTED_PROXY` to a comma-separated list of proxy peer addresses or CIDR ranges, such as `10.0.0.0/24,2001:db8::/32`. IPv4 and IPv6 are supported, including IPv4-mapped IPv6 peers. The corresponding `appHost` overrides are `config.host` and `config.trustedProxy`. Invalid addresses or ranges fail startup with a typed `ConfigError`; without these settings, the listener and RPC guard retain their loopback defaults.

For Railway, use `TRUSTED_PROXY=100.64.0.0/10`, the range its edge is observed to connect from. Railway does not promise this range, and it also trusts other services in the same Railway project; see [Railway's networking specs](https://docs.railway.com/networking/public-networking/specs-and-limits).

Configure the proxy to overwrite `X-Forwarded-Host` and `X-Forwarded-Proto` with the public authority and `http` or `https`, and preserve the browser's `Origin`. The RPC guard reads those forwarded values only from the configured peer and requires any Origin to match them. The application still owns its session Origin policy. Each `pnpm start` runs the supplied migrations before services and HTTP start; use the same migration table on every instance and choose `migrations.lockTimeout` for your deployment. No separate migration startup script is needed.

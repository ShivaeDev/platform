# Start a Platform app

Use Node 24 or newer and pnpm 12.8.1. The [starter](../../examples/starter) is a private notes app with PostgreSQL, Platform's app host, RPC, shared query state, routing, a form, Vite, React and Tailwind with shadcn-style components.

1. Copy `examples/starter` to your app folder, leaving out `node_modules`, `dist` and `.env.local`.
2. Rename the `name` in `package.json`. Outside this repository, replace every `workspace:*` dependency with its latest published version, rename `pnpm-workspace.copy.yaml` to `pnpm-workspace.yaml`, then run `pnpm install`. Keep that file: its catalog pins Effect and the shared Node platform to the same version and approves the `esbuild` and `msgpackr-extract` builds.
3. Copy `.env.example` to `.env.local` and set `DATABASE_URL` to your PostgreSQL database.
4. Run `pnpm dev` and open `http://127.0.0.1:5173`. The server watches TypeScript, Vite serves React, and the host runs migrations before serving HTTP/NDJSON RPC. Add a note to try the round trip.

To try it inside this repository, first run `./script/update` at the root, then do steps 3 and 4 inside `examples/starter`. The example URL uses the shared local PostgreSQL that setup prepares. Keep the `workspace:*` dependencies for repository development.

An npm-only copy requires published Platform and effect-react versions containing `appHost.ts` and `router.ts`. Those entry points are currently available in the workspace; verify the published versions before copying outside it.

Change the shared operations in `src/notes.ts`, the table and services in `src/server`, and the screen in `src/client`. The CSS declaration is local; no `vite/client` types are needed. `pnpm build && pnpm start` serves the built app on port 3000.

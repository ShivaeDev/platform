# @shivaedev/starter

A small notes app showing Platform's path from a migrated PostgreSQL table through RPC to a React form. Copy the folder to start your own application.

```tsx
const query = useQuery(client.api.list.query());
```

The authenticated route loader and screen share the same native query registry. Creating a note saves it in PostgreSQL and refreshes your list. Better Auth supplies signup, sign-in and sign-out; each account sees its own notes.

## Run or copy it

Follow the [quickstart](https://github.com/ShivaeDev/platform/blob/main/docs/framework/quickstart.md). In this repository, run `./script/update` at the root, copy `.env.example` to `.env.local` here, then run `pnpm dev`. Open `http://127.0.0.1:5173`.

The app uses Tailwind's neutral shadcn theme and application-owned `Button` and `Input` components. Server entry points are in `src/server`; the shared contract is `src/notes.ts`; the browser starts in `src/client/entry.tsx`.

`pnpm build && pnpm start` serves the built UI, Better Auth endpoints and HTTP/NDJSON RPC together at `http://127.0.0.1:3000`. Set `DATABASE_URL` and `BETTER_AUTH_SECRET` in `.env.local` or the shell. The secret needs at least 32 random characters; generate one with `openssl rand -base64 32`. For hosting behind a proxy, follow the quickstart's [Deploy section](https://github.com/ShivaeDev/platform/blob/main/docs/framework/quickstart.md#deploy), including the application auth configuration.

The starter's numbered migration path creates Better Auth's tables with `getMigrations(auth.options)` followed by `runMigrations()`. No separate auth migration command is needed. The protected query and command receive identity from the host's `betterAuthSessions` provider; signed-out calls return typed `Unauthorized` failures. The UI shows a sign-in prompt, and `SessionBoundary` replaces cached queries and drafts when the session changes.

The TypeScript configuration keeps strict application checking and sets `skipLibCheck: true` for dependencies that declare unused runtime types. Existing notes from the unauthenticated starter have no account owner and are not shown to signed-in users.

`pnpm test` runs the React tests and the PostgreSQL/HTTP round trips. Set `TEST_DATABASE_URL` to a dedicated PostgreSQL database whose role can create databases; the tests create disposable clones. Repository test runs supply `PLATFORM_EFFECT_SQL_TEST_DATABASE_URL` instead. Missing database configuration fails the test.

Before copying the app, run `pnpm --filter @shivaedev/starter check:published` from the repository root. It installs the exact versions in `published-versions.json` into temporary folders outside the workspace, checks imports from the framework READMEs and quickstart, and runs the copied app's typecheck, build and PostgreSQL/authenticated HTTP tests. It exercises published declaration and runtime exports without the workspace's `source` condition. Use the local test database from setup or set `TEST_DATABASE_URL`; the check fails if PostgreSQL is unavailable. Update the version file when adopting another published framework release, then run the check again.

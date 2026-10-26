# @shivaedev/starter

A small notes app showing Platform's path from a migrated PostgreSQL table through RPC to a React form. Create your own application with `pnpm create @shivaedev/app my-app`.

```tsx
const query = useQuery(client.api.list.query());
```

The authenticated route loaders and screens share the same native query registry. Create a note, open its title to edit it, or delete it and return to the refreshed list. Better Auth supplies signup, sign-in and sign-out; each account sees its own notes.

The `/notes/$noteId` route parses a numeric ID and loads `notes.get` through `loadQuery`. Its form uses `useEditor`: a live refresh keeps edited fields, a rejected save keeps the input, and a successful save applies the returned title. Updates and deletes send the version the client read. A stale version returns Platform's `Conflict` without changing the row; refresh and review the retained draft before saving again. Another account receives `NotFound` for an individual note. The word-count worker uses the same versioned notes repository and recalculates the count after an edit. The request runtime registers queue definitions through `NoteJobs.layer`, which creates queues and dead-letter queues without starting a worker. Create and edit enqueue after their write transaction; queue errors are logged and the saved note is returned with a pending word count. Enqueueing uses an independent connection, so a caller's outer transaction rollback does not remove its job.

To remove the example, delete `src/modules/notes` and its import and entry in `src/server/modules.ts`, `src/server/workerModules.ts`, `src/client/modules.ts` and `src/server/migrations.ts`, then run `pnpm ready`. Add your app's first module under `src/modules` and register its server, worker, client and migration pieces in those same registries.

## Create or run it

Follow the [quickstart](https://github.com/ShivaeDev/platform/blob/main/docs/framework/quickstart.md). Generated apps already have a git-ignored `.env.local` with a fresh authentication secret and development and test database URLs. In this repository, run `./script/update` at the root, copy `.env.example` to `.env.local` here, and replace the example secret with the output of `openssl rand -base64 32`. Run `pnpm dev` and open `http://127.0.0.1:5173`.

`pnpm dev` first runs `pnpm db:setup`, which prepares both local databases through `@shivaedev/local-postgres`. Have PostgreSQL 18.6 on loopback port 55432 or local Docker available. Then `pnpm migrate` applies migrations before the watchers start. Run `pnpm db:setup` separately to prepare databases without starting the app.

The app uses Tailwind's neutral theme and stock shadcn components in `src/client/ui`, configured by `components.json`. The notes list uses the TanStack React Table data-table pattern. The notes module’s `CodePreview` renders added, removed and context lines outside the shadcn folder. Server entry points are in `src/server`; the notes contract is `src/modules/notes/notes.ts`; the browser starts in `src/client/entry.tsx`.

Use `LabelledSwitch` for a setting with a visible label, controlled `checked` state and `onCheckedChange` callback. Its Base UI field associates the setting label with the stock shadcn Switch; the separate On/Off text is hidden from the accessible name. Put the setting text in `Field.Label`, since its association supplies the switch's name through `aria-labelledby`.

`pnpm build && pnpm migrate && pnpm start` serves the built UI, Better Auth endpoints and HTTP/NDJSON RPC together at `http://127.0.0.1:3000`. Set `DATABASE_URL` and `BETTER_AUTH_SECRET` in `.env.local` or the shell. The secret needs at least 32 random characters; generate one with `openssl rand -base64 32`. For hosting behind a proxy, follow the quickstart's [Deploy section](https://github.com/ShivaeDev/platform/blob/main/docs/framework/quickstart.md#deploy), setting `PUBLIC_URL` to your public app URL.

The server uses `betterAuthMount` and the scoped `authDatabase` pool from `@shivaedev/platform/server/better-auth/mount.ts`. The application supplies `authOptions` and composes its RPC session policy.

`AUTH_RATE_LIMIT_ENABLED` is an Effect Config boolean that defaults to `true` in every environment, including tests. Set it to `false` to disable Better Auth rate limiting for this app.

`TRUSTED_PROXY` controls both the host's forwarded authority and Better Auth's client IPs for auth rate limiting. `AUTH_CLIENT_IP_HEADER` is an Effect Config string that defaults to `x-forwarded-for`; set it to another header name to change which header auth reads. Auth accepts that header only from a matching transport peer and passes it to Better Auth's IP address options, with the same trusted proxy addresses and ranges. For the default `X-Forwarded-For`, the proxy must overwrite the header or append the actual client IP. When `TRUSTED_PROXY` is unset, auth ignores forwarded IP headers; when rate limiting is enabled, visitors share one rate-limit bucket per path.

The Railway web configuration sets `AUTH_CLIENT_IP_HEADER=x-real-ip` because Railway documents `X-Real-IP` as the client's remote IP. Its `X-Forwarded-For` chain can include edge hops outside the trusted `100.64.0.0/10` range, which Better Auth would select instead of the visitor. Railway does not document whether it replaces a caller-supplied `X-Real-IP`; verify that behavior in your production deployment before relying on visitor isolation.

A generated app runs `pnpm run setup` before its first commit: dependencies and Quality's pre-commit hook are installed, and the commit runs lint and typecheck. After cloning the generated repository, run `pnpm run setup` again for that checkout. Setup installs a hook only when the app has its own `.git`; it leaves an enclosing repository's hooks alone. Run `pnpm ready` for the full local gate. It uses the same peer, lint, typecheck, build and test script as `.github/workflows/ci.yml` and the published-starter check, with PostgreSQL backing the tests. The Railway CLI applies `.railway/railway.ts` to configure PostgreSQL, web and worker services. Both services build. Web runs `pnpm migrate` in its pre-deploy container, then starts HTTP and checks the database-backed `/health` route. Web uses migration mode `"check"` after pre-deploy. The worker starts `pnpm worker` with migration mode `"wait"`, polling until the schema is current before taking jobs. Services without the pre-deploy command use `"wait"` because deployment platforms may start services in any order. Neither process migrates at boot. The worker and migrate command need only `DATABASE_URL`; web also needs its auth secret and public URL. Follow the quickstart to plan and apply the configuration, connect the repository and deploy both services.

New apps start with `0001_auth`, which creates Better Auth's tables through `getMigrations()` and `runMigrations()` with pinned email/password and default `admin()` options. The notes module's `0002_notes` creates its final schema directly. Numbered files default-export their Effect and are discovered from each registered migration folder; append a migration when the app's schema changes. Migrations construct no auth instance and need no secret. No separate auth migration command is needed. Protected operations declare `AuthenticatedUser`; `authenticatedUserLayer(sessions)` supplies `SessionUser` from the `betterAuthSessions` provider. Note handlers use its id for ownership, and `notes.whoami` returns id, name and email without querying auth tables; signed-out calls return typed `Unauthorized` failures. The UI shows a sign-in prompt, and `SessionBoundary` replaces cached queries and drafts when the session changes.

Better Auth's `admin()` plugin owns the admin role. The foundation's auth migration creates its columns on new databases. After `pnpm migrate`, create the first admin with a new email address:

```sh
ADMIN_EMAIL=operator@example.com ADMIN_PASSWORD='a-long-unique-password' pnpm admin:create
```

The command reads `DATABASE_URL` and `BETTER_AUTH_SECRET` from the same environment as the server and calls Better Auth's public server-side `createUser` API. `ADMIN_NAME` defaults to `Administrator`. The command fails if the email is already registered. Sign in with those credentials. Admin-only RPCs declare Platform's [`AuthenticatedAdmin` middleware](https://github.com/ShivaeDev/platform/tree/main/packages/platform#requiring-a-role). The middleware reads the request's `SessionUser.role` and returns typed `Unauthorized` or `Forbidden` failures. Cookie caching stays disabled so the next request sees role changes.

The app-owned administration views at `/admin` and `/admin/jobs` use [`@shivaedev/admin`](https://github.com/ShivaeDev/platform/tree/main/packages/admin), the same `/rpc` transport and session registry as notes. Vite serves the React routes on port 5173 and proxies their RPC calls to the app host. They show health, queue counts, paginated failed jobs, dead-letter copies and original job detail. The default Jobs page is read-only. `/admin/notes` shows aggregate note statistics across all users. Every query and generated change subscription requires the `admin` role; `owner` alone does not grant access.

To add an app page, declare its Schema and native contract with `adminPage`, include it in the registry, register its server handlers, and add its React route. The note-statistics page is the example. Views live outside the stock shadcn folder and ship through create-app's three-way template updater. To enable retry, use `jobsPageWithRetry` with `jobsHandlersWithRetry`, bind that contract, and pass a runtime action for its `retry.run` to `JobsView`. Read-only bindings supply no retry action.

When the worker finds pending migrations, the host logs `Waiting for database migrations`, then `Still waiting for database migrations` every 30 seconds, with pending migration IDs and names and component names and details. It logs `Database migrations current` when the worker can proceed, or `Timed out waiting for database migrations` before failing. An already current schema emits none of these host lines. The worker logs `Worker ready to take jobs` after registering handlers. These lines use Effect’s logger.

The browser entry point creates `makeAuth({ baseUrl })` and supplies it to `App`. Session checking and auth actions use that instance. Stories can create an auth client for their own HTTP host with the application kit’s `authClient()` verb.

The TypeScript configuration keeps strict application checking and sets `skipLibCheck: true` for dependencies that declare unused runtime types.

To export Effect spans, follow the quickstart's [Deploy section](https://github.com/ShivaeDev/platform/blob/main/docs/framework/quickstart.md#deploy); the host and worker provide the same `otlpTracing` Layer.

Write new tests as stories following the [story-testing skill](https://github.com/ShivaeDev/platform/blob/main/packages/skills/skills/story-testing/SKILL.md). The kit in [`src/modules/notes/test-support/application.ts`](src/modules/notes/test-support/application.ts) owns a disposable PostgreSQL database and the real HTTP app host. Traits describe setup; verbs drive authenticated notes requests and start the word-count worker. Extend the kit when a feature needs another setup, action or readout.

```ts
import { expect } from "vitest";
import { app, signedIn } from "#modules/notes/test-support/application.ts";

app.it("saves a title for the signed-in account", [signedIn()], function* ({ actor }) {
 const notes = actor().notes;
 const saved = yield* notes.create({ title: "First note" });
 expect(yield* notes.list()).toEqual([saved]);
});
```

The kit uses `@shivaedev/test-story` on `effect-test`. Database stories run serially within each worker, use a live clock, commit HTTP writes and dispose their database clones after the host and pools close. Failures print the story and account aliases and host details, without session cookies. The deploy story uses a loopback proxy with HTTPS forwarding headers and checks secure session cookies and foreign-origin rejection. It does not exercise a browser or TLS termination. [`src/modules/notes/test-support/screens.ts`](src/modules/notes/test-support/screens.ts) supplies the separate happy-dom story kit; those stories use the in-memory RPC fixture to prove screen and form behavior. [`src/modules/notes/test-support/migration.ts`](src/modules/notes/test-support/migration.ts) checks the notes schema on the foundation without starting a host. Verbs perform actions, readouts return values, and specs own expectations and waits.

The [`notesApp` kit](src/modules/notes/test-support/app.tsx) renders `App` against the real HTTP host. Better Auth and RPC use `domFetch` with the DOM cookie session, without bearer tokens or copied cookies.

`pnpm test` loads `.env.local` and runs the React tests, the PostgreSQL/HTTP round trips and the notes schema check. Set `TEST_DATABASE_URL` to a dedicated PostgreSQL database whose role can create databases; the tests create disposable clones. Missing database configuration fails the test.

To verify the generated app, run `pnpm --filter @shivaedev/starter check:published` from the repository root. It installs the exact versions in `published-versions.json` into temporary folders outside the workspace, checks imports from the framework READMEs and quickstart, packs the create command, generates an app, and runs its Quality lint, typecheck, build, PostgreSQL/authenticated HTTP tests and notes schema check. It exercises published declaration and runtime exports without the workspace's `source` condition. Use the local test database from setup or set `TEST_DATABASE_URL`; the check fails if PostgreSQL is unavailable. Update the version file when adopting another published framework release, then run the check again.

Add `--registry` to generate the app with the published `pnpm create @shivaedev/app` command instead of packing the local generator; it cannot be combined with `--archives`. The Published starter workflow runs registry mode on a schedule and after each package publish.

## Deployment

Railway's native GitHub push deploys own the rollout. Web's pre-deploy command migrates the schema and records `RAILWAY_GIT_COMMIT_SHA` as the database release. The old worker stops fetching, finishes its active jobs, and steps aside; the new worker waits for its release marker and for old workers to drain before fetching. Background jobs pause for about a minute while web keeps serving. The old web can serve for a few seconds against the migrated schema, so migrations must tolerate that edge. The worker must deploy from every push: do not use watch paths that can skip its deployment, because a skipped worker stays paused.

The starter reads the release through Effect Config; without `RAILWAY_GIT_COMMIT_SHA`, local startup behaves as before. Workers refresh their typed heartbeat rows every second, including while draining. A heartbeat older than five polling intervals (five seconds by default) no longer blocks takeover after a crash. Clean shutdown and completed drain delete the worker's row. `CountWords` expires after 60 seconds, pg-boss's graceful stop timeout is 65 seconds, and Railway's worker `deploy.drainingSeconds` is 75 seconds, leaving a margin before Railway kills the process.

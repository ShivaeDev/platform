# @shivaedev/starter

A small notes app showing Platform's path from a migrated PostgreSQL table through RPC to a React form. Create your own application with `pnpm create @shivaedev/app my-app`.

```tsx
const query = useQuery(client.api.list.query());
```

The authenticated route loaders and screens share the same native query registry. Create a note, open its title to edit it, or delete it and return to the refreshed list. Better Auth supplies signup, sign-in and sign-out; each account sees its own notes.

The `/notes/$noteId` route parses a numeric ID and loads `notes.get` through `loadQuery`. Its form uses `useEditor`: a live refresh keeps edited fields, a rejected save keeps the input, and a successful save applies the returned title. Updates and deletes send the version the client read. A stale version returns Platform's `Conflict` without changing the row; refresh and review the retained draft before saving again. Another account receives `NotFound` for an individual note. The word-count worker uses the same versioned notes repository and recalculates the count after an edit. The request runtime registers queue definitions through `NoteJobs.layer`, which creates queues and dead-letter queues without starting a worker. Create and edit enqueue after their write transaction; queue errors are logged and the saved note is returned with a pending word count. Enqueueing uses an independent connection, so a caller's outer transaction rollback does not remove its job.

## Create or run it

Follow the [quickstart](https://github.com/ShivaeDev/platform/blob/main/docs/framework/quickstart.md). Generated apps already have a git-ignored `.env.local` with a fresh authentication secret and development and test database URLs. In this repository, run `./script/update` at the root, copy `.env.example` to `.env.local` here, and replace the example secret with the output of `openssl rand -base64 32`. Run `pnpm dev` and open `http://127.0.0.1:5173`.

`pnpm dev` first runs `pnpm db:setup`, which prepares both local databases through `@shivaedev/local-postgres`. Have PostgreSQL 18.6 on loopback port 55432 or local Docker available. Run `pnpm db:setup` separately to prepare databases without starting the app.

The app uses Tailwind's neutral shadcn theme and application-owned `Button` and `Input` components. Server entry points are in `src/server`; the shared contract is `src/notes.ts`; the browser starts in `src/client/entry.tsx`.

`pnpm build && pnpm start` serves the built UI, Better Auth endpoints and HTTP/NDJSON RPC together at `http://127.0.0.1:3000`. Set `DATABASE_URL` and `BETTER_AUTH_SECRET` in `.env.local` or the shell. The secret needs at least 32 random characters; generate one with `openssl rand -base64 32`. For hosting behind a proxy, follow the quickstart's [Deploy section](https://github.com/ShivaeDev/platform/blob/main/docs/framework/quickstart.md#deploy), setting `PUBLIC_URL` to your public app URL.

`TRUSTED_PROXY` controls both the host's forwarded authority and Better Auth's client IPs for auth rate limiting. Auth accepts `X-Forwarded-For` only from a matching transport peer and lets Better Auth resolve the forwarded chain with the same trusted proxy addresses and ranges. The proxy must overwrite the header or append the actual client IP. When `TRUSTED_PROXY` is unset, auth ignores forwarded IP headers; in production Better Auth warns and shares one rate-limit bucket per path across visitors.

A generated app runs `pnpm run setup` before its first commit: dependencies and Quality's pre-commit hook are installed, and the commit runs lint and typecheck. After cloning the generated repository, run `pnpm run setup` again for that checkout. Setup installs a hook only when the app has its own `.git`; it leaves an enclosing repository's hooks alone. Run `pnpm ready` for the full local gate. It uses the same lint, typecheck, build and test script as `.github/workflows/ci.yml` and the published-starter check, with PostgreSQL backing the tests. The Railway CLI applies `.railway/railway.ts` to configure PostgreSQL, web and worker services. Both services build and run `pnpm migrate` before deployment; the web service starts HTTP and checks `/health`, while the worker starts `pnpm worker`. Follow the quickstart to plan and apply the configuration, connect the repository and deploy both services.

The starter's numbered migration path creates Better Auth's tables with `getMigrations(auth.options)` followed by `runMigrations()`. No separate auth migration command is needed. Protected operations declare `AuthenticatedUser`; `authenticatedUserLayer(sessions)` supplies `SessionUser` from the `betterAuthSessions` provider. Note handlers use its id for ownership, and `notes.whoami` returns id, name and email without querying auth tables; signed-out calls return typed `Unauthorized` failures. The UI shows a sign-in prompt, and `SessionBoundary` replaces cached queries and drafts when the session changes.

The browser entry point creates `makeAuth({ baseUrl })` and supplies it to `App`. Session checking and auth actions use that instance. Stories can create an auth client for their own HTTP host with the application kit’s `authClient()` verb.

The TypeScript configuration keeps strict application checking and sets `skipLibCheck: true` for dependencies that declare unused runtime types. Existing notes from the unauthenticated starter have no account owner and are not shown to signed-in users.

To export Effect spans, enable Railway's tracing setting on each web and worker service. It supplies `OTEL_EXPORTER_OTLP_ENDPOINT` or `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`, plus exporter headers and service metadata. For another collector, set the base endpoint (the exporter appends `/v1/traces`) or the complete traces endpoint, `OTEL_EXPORTER_OTLP_HEADERS` as comma-separated `key=value` pairs with URL-encoded values, `OTEL_SERVICE_NAME`, and optional `OTEL_RESOURCE_ATTRIBUTES`. The complete traces endpoint takes precedence. The host and `noteWorker` provide the same `otlpTracing` Layer. With no endpoint, no exporter runs. This exports Effect spans; eBPF auto-instrumentation is not part of the framework path. The worker receiver story proves a real PostgreSQL job exports a `CountWords` span and still completes with a collector down; it does not prove a provider's deployment setup.

Write new tests as stories. The kit in [`src/test-support/application.ts`](src/test-support/application.ts) owns a disposable PostgreSQL database and the real HTTP app host. Traits such as `signedIn()`, `legacyNote(title)` and `behindProxy()` describe setup; verbs drive authenticated notes requests, rerun migrations through another host and start the word-count worker. Extend the kit with a trait or verb when a feature needs another setup or action.

```ts
import { expect } from "vitest";
import { app, signedIn } from "#test-support/application.ts";

app.it("saves a title for the signed-in account", [signedIn()], function* ({ actor }) {
 const notes = actor().notes;
 const saved = yield* notes.create({ title: "First note" });
 expect(yield* notes.list()).toEqual([saved]);
});
```

The kit uses `@shivaedev/test-story` on `effect-test`. Database stories run serially within each worker, use a live clock, commit HTTP writes and dispose their database clones after the host and pools close. Failures print the story and account aliases and host details, without session cookies. The deploy story uses a loopback proxy with HTTPS forwarding headers and checks secure session cookies and foreign-origin rejection. It does not exercise a browser or TLS termination. [`src/test-support/screens.ts`](src/test-support/screens.ts) supplies the separate happy-dom story kit; those stories use the in-memory RPC fixture to prove screen and form behavior. [`src/test-support/migration.ts`](src/test-support/migration.ts) isolates the migration upgrade story without starting a host.

`pnpm test` loads `.env.local` and runs the React tests, the PostgreSQL/HTTP round trips and the notes migration upgrade check. The upgrade check applies an older migration prefix, upgrades to the latest migrations, and compares the live column names and PostgreSQL types with the notes repository model. Set `TEST_DATABASE_URL` to a dedicated PostgreSQL database whose role can create databases; the tests create disposable clones. Repository test runs supply `PLATFORM_EFFECT_SQL_TEST_DATABASE_URL` instead. Missing database configuration fails the test.

To verify the generated app, run `pnpm --filter @shivaedev/starter check:published` from the repository root. It installs the exact versions in `published-versions.json` into temporary folders outside the workspace, checks imports from the framework READMEs and quickstart, packs the create command, generates an app, and runs its Quality lint, typecheck, build, PostgreSQL/authenticated HTTP tests and notes migration upgrade check. It exercises published declaration and runtime exports without the workspace's `source` condition. Use the local test database from setup or set `TEST_DATABASE_URL`; the check fails if PostgreSQL is unavailable. Update the version file when adopting another published framework release, then run the check again.

Add `--registry` to generate the app with the published `pnpm create @shivaedev/app` command instead of packing the local generator. The Published starter workflow runs this mode against a PostgreSQL service daily at 06:17 UTC, on manual dispatch, after each successful package publish, and on pull requests that change the check. A pull request whose pinned versions are not on npm yet is a release, so the workflow skips registry mode there; the packed starter checks those versions in CI, and the run after publishing checks them on npm. That run generates the app with the create-app version that just published; the other runs use `latest`, which pnpm resolves to the newest version past its one-day release age, the version a new user gets. Its optional `create-app-version` input selects a published generator version; an unavailable version fails the run. Registry mode cannot use `--archives`.

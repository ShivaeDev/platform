# Add a resource to the starter

Start with a running app from the [quickstart](./quickstart.md). Add a bookmarks resource with a generated numeric `id`, a nonempty `title` and an account owner. Follow the notes module below in order, replacing its names with bookmarks. Links point to the starter files copied into your generated app; keep using that app's pinned dependencies.

A feature is a module under `src/modules`. Put the bookmarks module in `src/modules/bookmarks`: the shared declaration in `bookmarks.ts`, persistence and services in `server/`, React components in `client/` and its story kits in `test-support/`. Keep SQL, session lookup and services out of the browser import graph. The app's registries in `src/server/modules.ts`, `src/server/workerModules.ts`, `src/client/modules.ts` are the only foundation files a module touches. This walkthrough adds a query and a create command; the notes module's background word-count job is an optional extension described in [Add a job](./quickstart.md#add-a-job).

## 1. Add the migration

Create `src/modules/bookmarks/server/migrations/` and add the next numbered file across every registered migration folder, such as `0004_bookmarks.ts`, default-exporting its migration Effect as [`0002_notes.ts`](../../examples/starter/src/modules/notes/server/migrations/0002_notes.ts) does. Create `bookmarks` with `id serial primary key`, `title text not null` and `user_id text not null`. Import `userReference` from `@shivaedev/identity/server/better-auth/userReference.ts` and reference its table and column with `ON DELETE CASCADE`, following [`0003_user_foreign_key.ts`](../../examples/starter/src/modules/notes/server/migrations/0003_user_foreign_key.ts) and [identity’s foreign-key guide](../../packages/identity/README.md#reference-users-from-app-tables). All folders share the `app_migrations` ledger, so an existing app upgrades by running a new, higher-numbered migration rather than by editing one it has already run.

Declare the migration directory on the server registration as `migrations: resolve(import.meta.dirname, "migrations")`, importing `resolve` from `node:path`. [`src/server/migrations.ts`](../../examples/starter/src/server/migrations.ts) loads the directories from the registered modules. [`databaseOptions.ts`](../../examples/starter/src/server/databaseOptions.ts) passes the combined loader to the host with `mode: "check"`, so startup asserts that its migrations are recorded in the ledger. Run `pnpm migrate` to apply the new migration before starting the host, as in the [quickstart](./quickstart.md). The [migration guide](./postgres-migrations.md) explains runner ownership and locks.

## 2. Define the Model

In `src/modules/bookmarks/bookmarks.ts`, define `Bookmark` with native `Model.Class`, following `Note` in [`notes.ts`](../../examples/starter/src/modules/notes/notes.ts). Use the same `Model.Field` variants for the generated id: it is present in JSON, selects and updates, and absent from inserts. Use `Schema.NonEmptyString` for the title and derive `BookmarkFields` with `Schema.Struct({ title: Bookmark.fields.title })` for the create payload and form.

In `src/modules/bookmarks/server/makeRepository.ts`, define `StoredBookmark` with the same public fields plus `userId: Schema.String`. Follow `StoredNote` in [the notes repository](../../examples/starter/src/modules/notes/server/makeRepository.ts). Notes allows a null owner; the new bookmarks table requires one. Keep the owner in the stored model and out of the public JSON model.

## 3. Make the repository

In that server module, call `makeRepository(StoredBookmark, { idColumn: "id", spanPrefix: "Bookmarks", tableName: "bookmarks" })`, imported from `@shivaedev/sql/repository.ts`. Its insert and query shapes come from the stored model; do not author a second ORM description.

Use `insert({ userId, title })` for creation. For the list, use `findMany` with `where: { userId }`, `select: ["id", "title"]` and an explicit id order, as [the notes service](../../examples/starter/src/modules/notes/server/Service.ts) does. Selecting only public fields keeps the owner out of the response.

## 4. Declare the service

Create `src/modules/bookmarks/server/Service.ts` with `defineService` from `@shivaedev/service/defineService.ts`. Follow [the notes service](../../examples/starter/src/modules/notes/server/Service.ts): initialize the repository, declare `SqlClient.SqlClient` and `Reactivity.Reactivity` in `requires`, and expose `list(userId)` and `create(input, userId)`.

Trim the title, reject a whitespace-only title with the command's field rejection, and map database failures to a declared `ServiceUnavailable`. Wrap the write in `transact` from `@shivaedev/sql/transact.ts`. Keep ownership explicit in both methods. The notes service also enqueues a job after its write transaction and logs queue failures; omit that part for bookmarks. This service refers to the command declaration you add next, so complete both steps before typechecking.

## 5. Declare the contract

Finish `bookmarks.ts` by following [`notes.ts`](../../examples/starter/src/modules/notes/notes.ts). Use `collection` from `@shivaedev/changes/keys.ts` for bookmark keys, `query` and `command` from `@shivaedev/contract/operation.ts`, and `contract` from `@shivaedev/contract/contract.ts` for the group.

Declare a `userId` bucket on the collection with `collection("bookmarks", Schema.Number, { userId: Schema.String })`. The list query declares a read policy requiring a session viewer and reads `bookmarks.bucket.userId(viewer.value.id)` from that viewer, returns `Schema.Array(Bookmark.json)` and declares `ServiceUnavailable`. The create command accepts `BookmarkFields`, returns `Bookmark.json`, declares `Invalid: fieldRejection(BookmarkFields)` and `ServiceUnavailable`, and invalidates the created record key and the viewer's `userId` bucket. Import `fieldRejection` from `@shivaedev/contract/rejection.ts` and the error from `@shivaedev/errors/taxonomy.ts`. Give this resource its own collection and contract names.

Apply `AuthenticatedUser` from `@shivaedev/identity/middleware.ts` to the group, as `Notes` does. The contract is browser safe and describes typed results and rejections; its query policy decides who may read, while server services implement SQL.

## 6. Register the server module

Create `src/modules/bookmarks/server/registration.ts` following [the notes registration](../../examples/starter/src/modules/notes/server/registration.ts). Build handlers with `Bookmarks.application.toLayer` that obtain the bookmarks service and pass the current `SessionUser` id to each method. Import `SessionUser` from `@shivaedev/identity/identity.ts`; never accept an owner id from the form or capture a user in a shared Layer.

Export `{ migrations: resolve(import.meta.dirname, "migrations"), group: Bookmarks, handlers, services }`, where `services` returns the service's Layer, and add it to the `modules` list in [`src/server/modules.ts`](../../examples/starter/src/server/modules.ts). The host merges every module's group, handlers, services and migration directories, so the new handlers share the existing session provider, migration loader and authenticated HTTP/NDJSON host.

## 7. Register the client module and route

Create `src/modules/bookmarks/client/make.ts` following [the notes client](../../examples/starter/src/modules/notes/client/make.ts): call `makeClient(Bookmarks, { url })` from `@shivaedev/contract/bind.ts` and return its `api` and `runtime`.

Create `client/registration.tsx` following [the notes client registration](../../examples/starter/src/modules/notes/client/registration.tsx). It returns the module's `api` and its routes. Add a `/bookmarks` route with TanStack's `createRoute`, spreading `queryRoute(() => client.api.list.query())` from `@shivaedev/react/queryRoute.ts` so the loader reads the list in the session's registry, and give it an error component. Add the registration to the `modules` list in [`src/client/modules.ts`](../../examples/starter/src/client/modules.ts). The session boundary mounts the module's bound live connection, so the list also refreshes after another session writes.

## 8. Build the form and screen

Follow [the notes create form](../../examples/starter/src/modules/notes/client/Create.tsx). Import `useCreate` from `@shivaedev/react/client/create.ts` and `useField` from `@shivaedev/form/client/react.ts`. Supply `BookmarkFields`, `{ title: "" }`, the client runtime and `client.api.create.run`. Bind the title input to the field's value, change and blur handlers, and submit with `create.save()`.

Keep a label, field error, save failure and pending button state. Follow [the notes screen](../../examples/starter/src/modules/notes/client/Screen.tsx) to render `useLoaderQuery` from `@shivaedev/react/client/useLoaderQuery.ts` with the same query atom and the route's loader data. The create command's invalidation refreshes that list. Applications own the wording and layout; the form owns encoded input and submission state.

## 9. Prove the PostgreSQL host path

Write the module's tests as stories, following the [story-testing skill](../../packages/skills/skills/story-testing/SKILL.md). Build an application kit in `src/modules/bookmarks/test-support` following [the notes application kit](../../examples/starter/src/modules/notes/test-support/application.ts): it starts the real host from [`src/test-support/host.ts`](../../examples/starter/src/test-support/host.ts) in an isolated database, and its traits sign accounts in. Following [`noteLifecycle.spec.ts`](../../examples/starter/src/modules/notes/server/noteLifecycle.spec.ts), sign up a user, create a bookmark over HTTP, list it, and read the stored rows through a kit readout to prove persistence. To replace a port, pass `replacements: Layer.succeed(MyPort, fake)` to `applicationHost` or `applicationWorker`; both accept one Layer for all replacement services. The starter’s queue client factory is the `JobsClientFactory` service, so tests replace it with `Layer.succeed(JobsClientFactory, testing.clientFactory)` rather than adding a host option. The host merges replacements over real services before handing them to RPC handlers; the factory replacement also feeds module service and worker construction. Check that the whitespace rejection leaves the table unchanged, anonymous calls fail, and a second user cannot list the first user's bookmarks.

Follow [the notes migration kit](../../examples/starter/src/modules/notes/test-support/migration.ts) and [`notesMigration.spec.ts`](../../examples/starter/src/modules/notes/server/notesMigration.spec.ts) to check the new table's columns and PostgreSQL types on the foundation schema. Run against a dedicated PostgreSQL test database whose role can create disposable databases:

```sh
pnpm test src/modules/bookmarks/server
```

Set `TEST_DATABASE_URL` first; the generated `.env.local` already holds it. In this repository, `./script/update` prepares the shared database; run focused tests with `pnpm --filter <package> test <paths>` and set the package database URL listed in the [root README](../../README.md#development). Confirm the PostgreSQL tests ran: a skipped test supplies no persistence or host evidence.

## 10. Prove the DOM path

Add a screen kit and `src/modules/bookmarks/client/Screen.dom.test.tsx` following [the notes screen kit](../../examples/starter/src/modules/notes/test-support/screens.ts) and [`Screen.dom.test.tsx`](../../examples/starter/src/modules/notes/client/Screen.dom.test.tsx). Render the real router and screen with an in-memory contract client in happy-dom. Assert that the loader and screen share one list query, empty input prevents a command, a field rejection retains the entered title, and successful creation refreshes the rendered list and clears the input.

```sh
pnpm test src/modules/bookmarks/client/Screen.dom.test.tsx
pnpm lint
pnpm typecheck
pnpm build
```

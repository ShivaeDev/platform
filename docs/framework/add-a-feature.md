# Add a resource to the starter

Start with a running app from the [quickstart](./quickstart.md). Add a bookmarks resource with a generated numeric `id`, a nonempty `title` and an account owner. Follow the notes feature below in order, replacing its names with bookmarks. Links point to the starter files copied into your generated app; keep using that app's pinned dependencies.

The shared declaration belongs in `src/bookmarks.ts`, persistence and services in `src/server`, and React components in `src/client`. Keep SQL, session lookup and services out of the browser import graph. This walkthrough adds a query and a create command; the notes feature's background word-count job and live subscription are optional extensions described in the [starter README](../../examples/starter/README.md#add-a-job).

## 1. Add the migration

In `src/server/migrations.ts`, append the next numbered entry to `Migrator.fromRecord`. Create `starter_bookmarks` with `id serial primary key`, `title text not null` and `"ownerId" text not null`. Preserve the existing entries and the `app_migrations` ledger: an existing app upgrades by running a new entry, rather than by editing a migration it has already run.

Follow [`migrations.ts`](../../examples/starter/src/server/migrations.ts): `001_create_notes` creates the table, and later entries add owner and word-count columns. Your new table can include its owner column from the start. [`databaseOptions.ts`](../../examples/starter/src/server/databaseOptions.ts) passes this loader to the host, which runs it before serving requests. The [migration guide](./postgres-migrations.md) explains runner ownership and locks.

## 2. Define the Model

In `src/bookmarks.ts`, define `Bookmark` with native `Model.Class`, following `Note` in [`notes.ts`](../../examples/starter/src/notes.ts). Use the same `Model.Field` variants for the generated id: it is present in JSON, selects and updates, and absent from inserts. Use `Schema.NonEmptyString` for the title and derive `BookmarkFields` with `Schema.Struct({ title: Bookmark.fields.title })` for the create payload and form.

In `src/server/makeBookmarksRepository.ts`, define `StoredBookmark` with the same public fields plus `ownerId: Schema.String`. Follow `StoredNote` in [`makeNotesRepository.ts`](../../examples/starter/src/server/makeNotesRepository.ts). Notes allows a null owner for old rows; the new bookmarks table requires an owner. Keep the owner in the stored model and out of the public JSON model.

## 3. Make the repository

In that server module, call `makeRepository(StoredBookmark, { idColumn: "id", spanPrefix: "Bookmarks", tableName: "starter_bookmarks" })`, following [`makeNotesRepository.ts`](../../examples/starter/src/server/makeNotesRepository.ts). Import `makeRepository` from `@shivaedev/effect-sql/repository.ts`. Its insert and query shapes come from the stored model; do not author a second ORM description.

Use `insert({ ownerId, title })` for creation. For the list, use `findMany` with `where: { ownerId }`, `select: ["id", "title"]` and an explicit id order, as [`NotesService.ts`](../../examples/starter/src/server/NotesService.ts) does. Selecting only public fields keeps the owner out of the response.

## 4. Declare the service

Create `src/server/BookmarksService.ts` with `defineService` from `@shivaedev/effect-service/define-service.ts`. Follow [`NotesService.ts`](../../examples/starter/src/server/NotesService.ts): initialize the repository, declare `SqlClient.SqlClient` and `Reactivity.Reactivity` dependencies, and expose `list(ownerId)` and `create(input, ownerId)`.

Trim the title, reject a whitespace-only title with the command's field rejection, and map database failures to a declared `ServiceUnavailable`. Wrap the write in `transact` from `@shivaedev/effect-sql/transact.ts`. Keep ownership explicit in both methods. The notes service also enqueues a job inside the transaction; omit that part for bookmarks. This service refers to the command declaration you add next, so complete both steps before typechecking.

## 5. Declare the contract

Finish `src/bookmarks.ts` by following [`notes.ts`](../../examples/starter/src/notes.ts). Use `collection` from `@shivaedev/effect-contract/keys.ts` for bookmark keys, `query` and `command` from `@shivaedev/effect-contract/operation.ts`, and `contract` from `@shivaedev/effect-contract/contract.ts` for the group.

The list query reads the collection list key, returns `Schema.Array(Bookmark.json)` and declares `ServiceUnavailable`. The create command accepts `BookmarkFields`, returns `Bookmark.json`, declares `Invalid: fieldRejection(BookmarkFields)` and `ServiceUnavailable`, and invalidates the created item's key. Import `fieldRejection` from `@shivaedev/effect-contract/rejection.ts` and the error from `@shivaedev/platform/errors/taxonomy.ts`. Give this resource its own collection and contract names.

Apply `Authenticated` from `@shivaedev/platform/rpc/middleware.ts` to the group, as `Notes` does. The contract is browser safe and describes typed results and rejections; it does not implement authorization or SQL.

## 6. Wire the host handlers

Follow [`notesHost.ts`](../../examples/starter/src/server/notesHost.ts). Build `Bookmarks.toLayer` handlers that obtain `BookmarksService` and pass the current `Identity.id` to each method. Import `Identity` from `@shivaedev/platform/rpc/identity.ts`; never accept an owner id from the form or capture a user in a shared Layer.

Combine `Notes.merge(Bookmarks)` for the host's `group`, merge the bookmark handler Layer with the existing handlers and routes, and merge `BookmarksService.layer` into `services`. Preserve the notes producer wiring. Keep the existing session provider and migration loader so the new handlers use the same authenticated HTTP/NDJSON host and database.

## 7. Add the route loader

Create `src/client/makeBookmarks.ts` by following [`makeNotes.ts`](../../examples/starter/src/client/makeNotes.ts): build an `AtomRpc.Service` for `Bookmarks` with the same HTTP protocol and NDJSON serialization, then `bind` it from `@shivaedev/effect-contract/bind.ts`. For this resource, return the bound API and runtime without the notes live subscription.

In [`SessionApp.tsx`](../../examples/starter/src/client/SessionApp.tsx), extend `connect` to create both clients for the same `/rpc` URL and return `{ notes, bookmarks }`. Pass both through `RoutedApp` to the router, keeping them inside the existing session boundary. [`App.tsx`](../../examples/starter/src/client/App.tsx) supplies the session id and recheck callback.

Add a `/bookmarks` route in [`appRouter.tsx`](../../examples/starter/src/client/appRouter.tsx) whose loader calls `loadQuery(context.context.registry, client.api.list.query(), context)` for the bookmark client. Import `loadQuery` from `@shivaedev/effect-react/router.ts`. Pass that client to the route's screen, and reuse the session's registry and `RouteFailure` error component.

## 8. Build the form and screen

Follow [`NoteCreate.tsx`](../../examples/starter/src/client/NoteCreate.tsx). Import `useCreate` from `@shivaedev/effect-react/create.ts` and `useField` from `@shivaedev/effect-form/react.ts`. Supply `BookmarkFields`, `{ title: "" }`, the client runtime and `client.api.create.run`. Bind the title input to the field's value, change and blur handlers, and submit with `create.save()`.

Keep a label, field error, save failure and pending button state. Follow [`NotesScreen.tsx`](../../examples/starter/src/client/NotesScreen.tsx) to render `useQuery` from `@shivaedev/effect-react/result-state.ts` with the same query atom the loader reads. Omit the word-count output and `useAtomMount(client.connection)` from the bookmark screen, since this client has no job or live subscription. The create command's invalidation refreshes that list. Applications own the wording and layout; the form owns encoded input and submission state.

## 9. Prove the PostgreSQL host path

Extend [`notesHost.test.ts`](../../examples/starter/src/server/notesHost.test.ts) using its [`test-support/postgres.ts`](../../examples/starter/src/test-support/postgres.ts) harness and authenticated HTTP client pattern in [`test-support/authHttp.ts`](../../examples/starter/src/test-support/authHttp.ts). Add a client for the bookmark group. Sign up a user, create a bookmark over HTTP, list it, and inspect `starter_bookmarks` through `SqlClient` to prove persistence. Check the whitespace rejection leaves the table unchanged, anonymous calls fail, and a second user cannot list the first user's bookmarks.

Follow [`notesMigration.spec.ts`](../../examples/starter/src/server/notesMigration.spec.ts) to check the new stored model's columns and PostgreSQL types after upgrading the previous migration prefix. Run against a dedicated PostgreSQL test database whose role can create disposable databases:

```sh
pnpm test src/server/notesHost.test.ts src/server/bookmarksMigration.spec.ts
```

Set `TEST_DATABASE_URL` first. In this repository, `./script/update` prepares the shared database and `pnpm ready` supplies the test URLs. Confirm the PostgreSQL tests ran: a skipped test supplies no persistence or host evidence.

## 10. Prove the DOM path

Add `src/client/BookmarksScreen.dom.test.tsx` following [`NotesScreen.dom.test.tsx`](../../examples/starter/src/client/NotesScreen.dom.test.tsx) and its [`test-support/notesClient.ts`](../../examples/starter/src/test-support/notesClient.ts) fixture. Render the real router and screen with an in-memory contract client in happy-dom. Assert the loader and screen share one list query, empty input prevents a command, a field rejection retains the entered title, and successful creation refreshes the rendered list and clears the input.

```sh
pnpm test src/client/BookmarksScreen.dom.test.tsx
pnpm lint
pnpm typecheck
pnpm build
```

The DOM test proves form and query behavior. The preceding host test proves real PostgreSQL and authenticated HTTP behavior. Neither establishes deployed browser cookies, responsive layout or mobile behavior; verify those in the application that will ship the feature.

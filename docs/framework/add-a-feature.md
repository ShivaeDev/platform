# Add a resource to the starter

Start with a running app from the [quickstart](./quickstart.md). Add a bookmarks resource with a generated numeric `id`, a nonempty `title` and an account owner. Generate the starting module, then use the notes module below to extend it with application-specific behavior. Links point to the starter files copied into your generated app; keep using that app's pinned dependencies.


```sh
pnpm dlx @shivaedev/create-app resource bookmarks
pnpm format
pnpm migrate
pnpm test src/modules/bookmarks/server/lifecycle.spec.ts
```

Run this from your generated app directory. The command writes a defined module in the notes shape: `Bookmarks.ts` with `defineModule`, a `model.ts`, one file per operation under `server/` (`List.ts`, `Create.ts`), the repository, next numbered migration, a client of the generated contract and an application story kit, and adds the server registration, which names `module:`, once to `src/server/modules.ts`. It accepts both full and minimal apps, names existing destination files instead of overwriting them, and requires the starter's `const modules = [...] as const;` module list. The resource starts with an `Item` model containing an id and a trimmed nonempty title. Its list and create operations require a session and keep each account's data private, and an open list reruns for its owner's new items and not for another account's. Admin pages, jobs and UI routes are optional additions. The generated PostgreSQL stories run through the real application host.

The numbered sections explain the same framework pieces and the UI and integration code you can add. Keep already-applied migrations unchanged when extending a generated module.

A feature is a module under `src/modules`. Put the bookmarks module in `src/modules/bookmarks`: the shared declaration in `bookmarks.ts`, persistence and services in `server/`, React components in `client/` and its story kits in `test-support/`. Keep SQL, session lookup and services out of the browser import graph. Register the server feature once in `src/server/modules.ts`; the host, worker and admin handlers use that list. Register browser routes and bindings separately in `src/client/modules.ts`. Browser-only queue schemas belong in `src/admin/foundation.ts` when the Jobs view needs to decode their payloads. This walkthrough adds a query and a create command; the notes module's background word-count job is an optional extension described in [Add a job](./quickstart.md#add-a-job).

An `admin/` segment marks admin-only code. Put a wholly admin-only feature under `src/modules/admin/<name>`, with its shared declarations, `server/` and `client/` inside that module. For admin tools belonging to a member feature, keep the module's ownership: put browser-safe declarations in `src/modules/bookmarks/admin/`, reads and handlers in `src/modules/bookmarks/server/admin/`, and views and client bindings in `src/modules/bookmarks/client/admin/`. Each module reads only its own tables; an admin page needing another module's data composes that module's exposed operations. A path makes intent visible; the page's permission enforces access.

The starter's [statistics page](../../examples/starter/src/modules/notes/admin/pages.ts), [read](../../examples/starter/src/modules/notes/server/admin/readStatistics.ts), [server registration](../../examples/starter/src/modules/notes/server/admin/registration.ts) and [client registration](../../examples/starter/src/modules/notes/client/admin/registration.tsx) show this layout. The all-user read stays beside notes persistence in `server/admin/`, rather than moving into an unrelated admin module. Declare the page with `adminPage`, register its handlers with `registerAdmin`, and attach that registration as the server module's `admin` field; the [admin guide](../../packages/admin/README.md#keep-admin-code-in-admin-paths) explains the composition.

## 1. Add the migration

Create `src/modules/bookmarks/server/migrations/` and add the next numbered file across every registered migration folder, such as `0005_bookmarks.ts`, default-exporting its migration Effect as [`0002_notes.ts`](../../examples/starter/src/modules/notes/server/migrations/0002_notes.ts) does. Create `bookmarks` with `id serial primary key`, `title text not null` and `user_id text not null`. Import `userReference` from `@shivaedev/identity/server/better-auth/userReference.ts` and reference its table and column with `ON DELETE CASCADE`, following [`0003_user_foreign_key.ts`](../../examples/starter/src/modules/notes/server/migrations/0003_user_foreign_key.ts) and [identity’s foreign-key guide](../../packages/identity/README.md#reference-users-from-app-tables). All folders share the `app_migrations` ledger, so an existing app upgrades by running a new, higher-numbered migration rather than by editing one it has already run.

Declare a native migration loader on the server registration, as shown in step 6. [`src/server/migrations.ts`](../../examples/starter/src/server/migrations.ts) loads the directories from the registered modules. [`databaseOptions.ts`](../../examples/starter/src/server/databaseOptions.ts) passes the combined loader to the host with `mode: "check"`, so startup asserts that its migrations are recorded in the ledger. Run `pnpm migrate` to apply the new migration before starting the host, as in the [quickstart](./quickstart.md). The [migration guide](./postgres-migrations.md) explains runner ownership and locks.

## 2. Define the Model

In `src/modules/bookmarks/bookmarks.ts`, define `Bookmark` with native `Model.Class`, following `Note` in [`model.ts`](../../examples/starter/src/modules/notes/model.ts). Use the same `Model.Field` variants for the generated id: it is present in JSON, selects and updates, and absent from inserts. Use `Schema.NonEmptyString` for the title and derive `BookmarkFields` with `Schema.Struct({ title: Bookmark.fields.title })` for the create payload and form.

In `src/modules/bookmarks/server/Repository.ts`, define `StoredBookmark` with the same public fields plus `userId: bucket(Schema.String)`, importing `bucket` from `@shivaedev/changes/buckets.ts`. Follow `StoredNote` in [the notes repository](../../examples/starter/src/modules/notes/server/Repository.ts). Notes allows a null owner; the new bookmarks table requires one. Keep the owner in the stored model and out of the public JSON model. The bucket metadata lets repository writes announce changes to each affected owner's list.

## 3. Make the repository

In that server module, call `makeRepository(StoredBookmark, { collection: bookmarks, idColumn: "id", spanPrefix: "Bookmarks", tableName: "bookmarks" })`, imported from `@shivaedev/sql/repository.ts`. Import the shared `bookmarks` collection declared in step 5 from `#modules/bookmarks/bookmarks.ts`. Its insert and query shapes come from the stored model; do not author a second ORM description. Give the repository its own service with `defineRepository` from `@shivaedev/sql/defineRepository.ts`, as the [sql guide](../../packages/sql/README.md#share-a-tables-repository-and-domain-reads-between-services) shows, so services list its tag in `requires` and yield it instead of building it in their initializers.

Use `insert({ userId, title })` for creation. For the list, use `findMany` with `where: { userId }`, `select: ["id", "title"]` and an explicit id order, as [the notes list operation](../../examples/starter/src/modules/notes/server/List.ts) does. Selecting only public fields keeps the owner out of the response. The `userId` filter also names the key the live list listens on, as step 5 explains.

## 4. Declare the service

Create `src/modules/bookmarks/server/service.ts` with `defineService` from `@shivaedev/service/defineService.ts`, following the [service model](../../packages/service/README.md#how-to-think-about-it). Write each operation as an `Effect.fn("Bookmarks.<operation>")` export in its own file beside the service, yielding the repository and every other dependency; list the repository tag and `SessionUser` in `requires`; and use `Effect.void` as `initialize`, because the service owns no state. Operations read the caller by yielding `SessionUser` rather than taking a user id, and a service that does so is built per request. Register its Layer in the host’s `requestServices` slot, and register the repository Layer in `services`. Handlers call `list()` and `create(input)`; the host supplies the caller to the request Layer.

Trim the title, reject a whitespace-only title with the command's field rejection, and map database failures to a declared `ServiceUnavailable`. A single repository write commits on its own: the repository derives record and bucket keys from the written rows and announces them when that write commits. Wrap writes in `transact` from `@shivaedev/sql/transact.ts` only when several must commit together; rollback then discards every write and its announcement. The notes service wraps a note's insert and its word-count job, because jobs' `enqueue` joins the open SQL transaction on the same connection. Bookmarks has one write and no job, so it needs no `transact`. This service refers to the command declaration you add next, so complete both steps before typechecking.

Workers use the same model repository and the same rule for `transact`. Only raw-SQL writers declare write keys manually: use `changes` from `@shivaedev/sql/changes.ts` and call its `record()` method inside the write's `transact`, as shown in [the live-update guide](./live-updates.md#raw-sql-writers).

## 5. Declare the contract

Finish `bookmarks.ts` by following [`Notes.ts`](../../examples/starter/src/modules/notes/Notes.ts). Use `collection` from `@shivaedev/changes/keys.ts` for bookmark keys, `query` and `command` from `@shivaedev/contract/operation.ts`, and `contract` from `@shivaedev/contract/contract.ts` for the group.

Declare a `userId` bucket on the collection with `collection("bookmarks", Schema.Number, { userId: Schema.String })`, matching the stored model's bucket field. The list query declares a read policy requiring a session viewer, returns `Schema.Array(Bookmark.json)` and declares `InternalServerError` and `ServiceUnavailable`. It declares no `reads`: its repository read filters by `userId`, so the live list listens on the owner's bucket and reruns for writes to that account's bookmarks and no other's, as the [live-update guide](./live-updates.md#declare-who-may-read-and-let-the-reads-name-their-keys) explains. Declare `reads` only for keys no repository read names, such as a raw SQL join that does not mark its key with `readSql`. The create command accepts `BookmarkFields`, returns `Bookmark.json`, declares `InternalServerError`, `Invalid: fieldRejection(BookmarkFields)` and `ServiceUnavailable`, and sets `invalidates: () => []`. The repository already announces the created record and owner's bucket; the command adds no keys. Import `fieldRejection` from `@shivaedev/contract/rejection.ts` and the errors from `@shivaedev/errors/taxonomy.ts`. Give this resource its own collection and contract names.

Export the operation declarations as `List` and `Create` for the server boundary. Apply `AuthenticatedUser` from `@shivaedev/identity/middleware.ts` to the group, as `Notes` does. The contract is browser safe and describes typed results and rejections; its query policy decides who may read, while server services implement SQL.

## 6. Register the server module

Create `src/modules/bookmarks/server/registration.ts` following [the notes registration](../../examples/starter/src/modules/notes/server/registration.ts). Build handlers with `Bookmarks.application.toLayer` that obtain the bookmarks service and call its operations. The service is registered in `requestServices`, so its operations yield `SessionUser`, imported from `@shivaedev/identity/identity.ts`, to read the owner. The owner comes from the session, never the form. Each operation is an `Effect.fn` export in its own file beside `service.ts`.

Export an object satisfying `AppModule`. Its required fields are `name`, `group`, `handlers`, `services` and `migrations`; `requestServices` registers caller-dependent Layers. Services and handlers are native Layers; migrations contains a native loader and optional schema `components`.

```ts
import { resolve } from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import * as MigratorFileSystem from "effect/sql/MigratorFileSystem";
import { rpcBoundary } from "@shivaedev/errors/boundary.ts";
import { InternalServerError } from "@shivaedev/errors/taxonomy.ts";
import type { AppModule } from "@shivaedev/server/AppModule.ts";
import { Bookmarks, Create, List } from "#modules/bookmarks/bookmarks.ts";
import { BookmarksRepository } from "./Repository.ts";
import { bookmarksService } from "./service.ts";

const boundaryOptions = { unexpected: (message: string) => new InternalServerError({ message }) };
const handlers = Bookmarks.application.toLayer({
	"bookmarks.create": (input) =>
		Effect.gen(function* () {
			const service = yield* bookmarksService;
			return yield* service.create(input);
		}).pipe(rpcBoundary(Create.error, boundaryOptions)),
	"bookmarks.list": () =>
		Effect.gen(function* () {
			const service = yield* bookmarksService;
			return yield* service.list();
		}).pipe(rpcBoundary(List.error, boundaryOptions)),
});

export const bookmarksRegistration = {
	name: "bookmarks",
	group: Bookmarks,
	handlers,
	requestServices: bookmarksService.layer,
	services: BookmarksRepository.layer,
	migrations: {
		loader: MigratorFileSystem.fromFileSystem(resolve(import.meta.dirname, "migrations")).pipe(Effect.provide(NodeServices.layer)),
	},
} satisfies AppModule;
```

Add `bookmarksRegistration` to the `modules` list in [`src/server/modules.ts`](../../examples/starter/src/server/modules.ts). That list feeds `appModules`, which combines the contracts, handlers, services, migration loaders and optional `admin`, `ports`, `queues` and `workers`. `admin` is the result of `registerAdmin`; `ports` is a Layer of default adapters, overridden by the composition's `replacements` Layer. For jobs, spread the `queues` and `workers` returned by `jobModule` onto the same registration. Both application processes use this composition, and the foundation's server Jobs handlers receive the queues collected from these entries. The browser keeps its own payload schemas and bindings without importing server registrations.

## 7. Register the client module and route

Create `src/modules/bookmarks/client/make.ts` following [the notes client](../../examples/starter/src/modules/notes/client/make.ts): call `makeClient(Bookmarks, { url })` from `@shivaedev/contract/bind.ts` and return its `api` and `runtime`.

Create `client/registration.tsx` following [the notes client registration](../../examples/starter/src/modules/notes/client/registration.tsx). It returns the module's `api` and its routes. Add a `/bookmarks` route with TanStack's `createRoute`, spreading `queryRoute(() => client.api.list.query())` from `@shivaedev/react/adapters/queryRoute.ts` so the loader reads the list in the session's registry, and give it an error component. Add the registration to the `modules` list in [`src/client/modules.ts`](../../examples/starter/src/client/modules.ts). The session boundary mounts the module's bound live connection, so the list also refreshes after another session writes.

## 8. Build the form and screen

Follow [the notes create form](../../examples/starter/src/modules/notes/client/Create.tsx). Import `useCreate` from `@shivaedev/react/client/create.ts` and `useField` from `@shivaedev/form/adapters/react.ts`. Supply `BookmarkFields`, `{ title: "" }`, the client runtime and `client.api.create.run`. Bind the title input to the field's value, change and blur handlers, and submit with `create.save()`.

Keep a label, field error, save failure and pending button state. Follow [the notes screen](../../examples/starter/src/modules/notes/client/Screen.tsx) to render `useLoaderQuery` from `@shivaedev/react/client/useLoaderQuery.ts` with the same query atom and the route's loader data. The repository's committed bucket announcement refreshes that list. Applications own the wording and layout; the form owns encoded input and submission state.

## 9. Call an outside API

Reach an outside API with the native HTTP client behind a port, following [the JSONPlaceholder source](../../examples/starter/src/modules/notes/server/adapters/jsonPlaceholder.ts). It implements the [NoteSource port](../../examples/starter/src/modules/notes/server/Source.ts), a native Effect service whose method returns a title or typed domain failures. The source's Layer uses `@shivaedev/http`'s `filterStatus` and `readBoundedJson` with the native HTTP client: check the status before reading a bounded, Schema-decoded body, then translate remote failures into the port's errors. The service depends on the port through `requires`, and [the module registration](../../examples/starter/src/modules/notes/server/registration.ts) provides the source Layer. Calls through the native HTTP client are Effects, so they need no `adapters/` folder; only a library call that returns a Promise, can throw or reaches the host does. The notes `import` command fetches a source title before creating a note through the existing persistence path. Keeping every piece inside the notes module lets `create-app --minimal` remove the whole example.

Prove the source through the application's story kit, as [the import stories](../../examples/starter/src/modules/notes/server/noteImport.spec.ts) do. [The notes kit](../../examples/starter/src/modules/notes/test-support/application.ts) acquires test-story's `fakeHttpService` and scopes `routeOutbound` to the outside API's hostname. The real authenticated RPC command, service, source and HTTP client run against that fake API. Cover a successful response, an error status and a malformed body; assert on the returned value or typed failure and that failed imports leave no note. Only independent pure mapping code gets a colocated `.unit.test.ts`; a unit test must not import `effect/http`, even indirectly. This source uses Schema decoding and a title projection, so there is no separate mapping module to test.

## 10. Prove the PostgreSQL host path

Write the module's tests as stories, following the [story-testing skill](../../packages/skills/skills/story-testing/SKILL.md). Build an application kit in `src/modules/bookmarks/test-support` following [the notes application kit](../../examples/starter/src/modules/notes/test-support/application.ts): it starts the real host from [`src/test-support/host.ts`](../../examples/starter/src/test-support/host.ts) in an isolated database, and its traits sign accounts in. Following [`noteLifecycle.spec.ts`](../../examples/starter/src/modules/notes/server/noteLifecycle.spec.ts), sign up a user, create a bookmark over HTTP, list it, and read the stored rows through a kit readout to prove persistence. To replace a port, pass `replacements: Layer.succeed(MyPort, fake)` to `applicationHost` or `applicationWorker`; both accept one Layer for all replacement services. The starter’s queue client factory is the `JobsClientFactory` service, so tests replace it with `Layer.succeed(JobsClientFactory, testing.clientFactory)` rather than adding a host option. The host merges replacements over real services before handing them to RPC handlers; the factory replacement also feeds module service and worker construction. Check that the whitespace rejection leaves the table unchanged, anonymous calls fail, and a second user cannot list the first user's bookmarks. The generated stories also keep a list open over the real WebSocket: it receives its owner's new bookmark, and another account's new bookmark sends it no update.

Follow [the notes migration kit](../../examples/starter/src/modules/notes/test-support/migration.ts) and [`notesMigration.spec.ts`](../../examples/starter/src/modules/notes/server/notesMigration.spec.ts) to check the new table's columns and PostgreSQL types on the foundation schema. Run against a dedicated PostgreSQL test database whose role can create disposable databases:

```sh
pnpm test src/modules/bookmarks/server
```

Set `TEST_DATABASE_URL` first; the generated `.env.local` already holds it. In this repository, `./script/update` prepares the shared database; run focused tests with `pnpm --filter <package> test <paths>` and set the package database URL listed in the [root README](../../README.md#development). Confirm the PostgreSQL tests ran: a skipped test supplies no persistence or host evidence.

## 11. Prove the DOM path

Add a screen kit and `src/modules/bookmarks/client/Screen.dom.test.tsx` following [the notes screen kit](../../examples/starter/src/modules/notes/test-support/screens.ts) and [`Screen.dom.test.tsx`](../../examples/starter/src/modules/notes/client/Screen.dom.test.tsx). Render the real router and screen with an in-memory contract client in happy-dom. Assert that the loader and screen share one list query, empty input prevents a command, a field rejection retains the entered title, and successful creation refreshes the rendered list and clears the input.

```sh
pnpm test src/modules/bookmarks/client/Screen.dom.test.tsx
pnpm lint
pnpm typecheck
pnpm build
```

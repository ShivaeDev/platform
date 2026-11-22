# Add a resource to the starter

Start with a running app from the [quickstart](./quickstart.md). Add a bookmarks resource with a generated numeric `id`, a nonempty `title` and an account owner. Generate the starting module, then use the notes module below to extend it with application-specific behavior. Links point to the starter files copied into your generated app; keep using that app's pinned dependencies.

```sh
pnpm dlx @shivaedev/create-app resource bookmarks
pnpm format
pnpm migrate
pnpm test src/modules/bookmarks/server/lifecycle.spec.ts src/modules/bookmarks/client/list.dom.spec.ts
```

Run this from your generated app directory. The command writes a defined module in the notes shape: `Bookmarks.ts` with `defineModule`, a `model.ts`, one file per operation under `server/` (`List.ts`, `Create.ts`), the repository, next numbered migration, an application story kit and the server registration, which names `module:`. For the browser it writes `client/module.tsx`, the client module with a signed-in `/bookmarks` route, `client/Screen.tsx`, the screen that route renders, `test-support/screen.ts`, a screen kit that opens the route in the real app, and `client/list.dom.spec.ts`, its first story. It edits no file outside the module's folder: the server finds the registration and the browser finds the client module by its folder. It accepts both full and minimal apps and names existing destination files instead of overwriting them. The resource starts with an `Item` model containing an id and a trimmed nonempty title. Its list and create operations require a session and keep each account's data private, and an open list reruns for its owner's new items and not for another account's. Admin pages and jobs are optional additions. The generated PostgreSQL and screen stories run through the real application host.

The numbered sections explain the files the command writes, then the UI and integration code you add; the last section moves a module written in the old form to this shape. Keep already-applied migrations unchanged when extending a generated module.

A feature is a module under `src/modules`. The bookmarks module lives in `src/modules/bookmarks`: the browser-safe model in `model.ts`, the defined module in `Bookmarks.ts`, operations, persistence and the server registration in `server/`, React components in `client/` and its story kits in `test-support/`. `Bookmarks.ts` imports the operations, so the browser never imports it or anything under `server/`; client code imports the generated contract from `#generated/modules/bookmarks/Bookmarks.ts` and the model. The server registration in `server/registration.ts` registers the feature by its folder: `pnpm generate` lists it in `src/generated/server/modules.ts`, the list the host, worker and admin handlers use, so there is no server list to edit. Its client module in `client/module.tsx` joins the browser the same way: `pnpm generate` lists it in `src/generated/client/modules.ts`, so there is no client list to edit either. Browser-only queue schemas belong in `src/admin/foundation.ts` when the Jobs view needs to decode their payloads. This walkthrough covers a query and a create command; the notes module's background word-count job is an optional extension described in [Add a job](./quickstart.md#add-a-job).

An `admin/` segment marks admin-only code. Put a wholly admin-only feature under `src/modules/admin/<name>`, with its model, module, `server/` and `client/` inside that module. For admin tools belonging to a member feature, keep the module's ownership: put the admin module and its page declarations in `src/modules/bookmarks/admin/`, its operations in `src/modules/bookmarks/server/admin/`, and views and client bindings in `src/modules/bookmarks/client/admin/`. Each module reads only its own tables; an admin page needing another module's data composes that module's exposed operations. A path makes intent visible; the page's permission enforces access.

The starter's [statistics page](../../examples/starter/src/modules/notes/admin/pages.ts), its [module](../../examples/starter/src/modules/notes/admin/Statistics.ts) and [read operation](../../examples/starter/src/modules/notes/server/admin/Read.ts), [server registration](../../examples/starter/src/modules/notes/server/admin/registration.ts) and the statistics page's [client module](../../examples/starter/src/modules/notes/client/admin/module.tsx) show this layout. The all-user read stays beside notes persistence in `server/admin/`, rather than moving into an unrelated admin module. Declare the page with `adminPage` over the module's generated contract, register the module for it with `registerAdmin`, and attach that registration as the server module's `admin` field; the [admin guide](../../packages/admin/README.md#keep-admin-code-in-admin-paths) explains the composition.

## 1. Add the migration

The command writes `src/modules/bookmarks/server/migrations/` with the next numbered file across every registered migration folder, such as `0005_bookmarks.ts`, default-exporting its migration Effect as [`0002_notes.ts`](../../examples/starter/src/modules/notes/server/migrations/0002_notes.ts) does. It creates `bookmarks` with `id serial primary key`, `title text not null` and `user_id text not null`, referencing the user table and column of `userReference` from `@shivaedev/identity/server/better-auth/userReference.ts` with `on delete cascade`, as [`0003_user_foreign_key.ts`](../../examples/starter/src/modules/notes/server/migrations/0003_user_foreign_key.ts) and [identity’s foreign-key guide](../../packages/identity/README.md#reference-users-from-app-tables) do. All folders share the `app_migrations` ledger, so an existing app upgrades by running a new, higher-numbered migration rather than by editing one it has already run.

The server registration in step 5 declares the folder's native migration loader. [`src/server/migrations.ts`](../../examples/starter/src/server/migrations.ts) loads the directories from the registered modules. [`databaseOptions.ts`](../../examples/starter/src/server/databaseOptions.ts) passes the combined loader to the host with `mode: "check"`, so startup asserts that its migrations are recorded in the ledger. Run `pnpm migrate` to apply the new migration before starting the host, as in the [quickstart](./quickstart.md). The [migration guide](./postgres-migrations.md) explains runner ownership and locks.

## 2. Define the model

`src/modules/bookmarks/model.ts` defines `Item` with native `Model.Class`, as `Note` in [the notes model](../../examples/starter/src/modules/notes/model.ts) does. The generated id uses `Model.Field` variants: it is present in JSON, selects and updates, and absent from inserts. The title is `Schema.Trim.check(Schema.isNonEmpty({ message: "Enter a title" }))`, so decoding trims it and refuses an empty one with that message. `Fields`, built with `Schema.Struct({ title: Item.fields.title })`, is the create payload and the form's fields. The form decodes with it before sending, so a blank or whitespace-only title shows "Enter a title" without a request, and the server decodes the payload with the same schema. `keys` is `collection("bookmarks", Schema.Number, { userId: Schema.String })` from `@shivaedev/changes/keys.ts`: the collection's name is the table name and its `userId` bucket matches the stored model's bucket field. `toItem` picks the public fields from a stored row. This file stays browser safe.

Mark a field whose value must stay out of logs, traces and failure reports once, on the stored model, with `sensitive: true` or a Redacted schema. The application host masks that name in every diagnostic of every operation, and the worker host in every log, error report and exported trace of its jobs, so nothing else needs marking. A value read with raw SQL has no model: decode the read with an exported Schema class, mark its fields there with `sensitive: true` and return its instances. The generated wire imports the class, so the host masks those fields in every diagnostic of each operation whose success carries it, including its live updates. The host masks a name the class marks in that operation's failures sent to the browser too, and a live subscription carries every query of the module, so give a rejection that must show the value to the person a different field name. Keep the host's `config.sensitiveKeys` for values that only jobs handle or third parties produce; the [errors README](../../packages/errors/README.md#masking-secrets-in-failures) describes the policy.

A stored model can carry a value only the server may hold, such as a provider refresh token or a password hash. Declare it with `serverOnly(Schema.String)` from `@shivaedev/sql/serverOnly.ts`: the column holds the plain value, handlers receive a `Redacted`, the generator refuses an operation that returns it, and encoding the row for RPC fails instead of sending it. A field the client may see but logs may not takes a `sensitive: true` annotation instead, which masks it in diagnostics only. The [sql guide](../../packages/sql/README.md#fields-that-never-leave-the-server) compares the two.

## 3. Make the repository

`src/modules/bookmarks/server/Repository.ts` defines `StoredItem` with the public fields, `...Model.fields(Item)`, plus `userId: bucket(Schema.String)`, importing `bucket` from `@shivaedev/changes/buckets.ts`, as `StoredNote` in [the notes repository](../../examples/starter/src/modules/notes/server/Repository.ts) does. Notes allows a null owner; the bookmarks table requires one. The owner stays in the stored model and out of the public JSON model, and the bucket metadata lets repository writes announce changes to each affected owner's list.

It calls `makeRepository(StoredItem, { collection: keys })` from `@shivaedev/sql/repository.ts`. The `bookmarks` collection names the table, the model's `id` field keys its rows, and its operation spans are named after the table, such as `bookmarks.findById`; its insert and query shapes come from the stored model, so there is no second ORM description. `defineRepository` from `@shivaedev/sql/defineRepository.ts` gives it its own service, `BookmarksRepository`, which operations yield, as the [sql guide](../../packages/sql/README.md#share-a-tables-repository-and-domain-reads-between-services) shows.

## 4. Write the operations

Each operation is its own file under `server/`, written once as its business logic: `query` or `command` from `@shivaedev/contract/operation.ts` with a `payload` schema, when it takes one, and a generator `*run` that yields its dependencies. [The notes list](../../examples/starter/src/modules/notes/server/List.ts) and [create](../../examples/starter/src/modules/notes/server/Create.ts) operations show the shape.

`server/List.ts` exports `List`, a `query` whose `run` yields `BookmarksRepository` and `SessionUser` from `@shivaedev/identity/identity.ts` and returns `findMany` with `where: { userId }`, `select: ["id", "title"]` and an explicit id order. Selecting only public fields keeps the owner out of the response. A query without `readPolicy` gets contract's `signedIn`, so the list writes none. It declares no `reads` either: its repository read filters by `userId`, so the live list listens on the owner's bucket and reruns for writes to that account's bookmarks and no other's, as the [live-update guide](./live-updates.md#declare-who-may-read-and-let-the-reads-name-their-keys) explains. Declare `reads` only for keys no repository read names, such as a raw SQL join that does not mark its key with `readSql`.

`server/Create.ts` exports `Create`, a `command` with `payload: Fields` whose `run` yields the repository and `SessionUser`, inserts `{ title, userId }` and maps the row through `toItem`. The owner comes from the session, never the form. The repository announces the created record and its owner's bucket when the insert commits, so the command declares no `invalidates`. A command declares `invalidates` only when it changes something no repository write or recorded `changes` announces, as the [live-update guide](./live-updates.md#mark-buckets-on-the-stored-model) explains.

A single repository write commits on its own: the repository derives record and bucket keys from the written rows and announces them when that write commits. Wrap writes in `transact` from `@shivaedev/sql/transact.ts` only when several must commit together; rollback then discards every write and its announcement. The notes `create` operation wraps a note's insert and its word-count job, because jobs' `enqueue` joins the open SQL transaction on the same connection. Bookmarks has one write and no job, so it needs no `transact`. Workers use the same model repository and the same rule for `transact`. Only raw-SQL writers declare write keys manually: use `changes` from `@shivaedev/sql/changes.ts` and call its `record()` method inside the write's `transact`, as shown in [the live-update guide](./live-updates.md#raw-sql-writers).

Neither operation states its success or failures. The build generates them from `run`'s type into the module's wire and browser contract, and the framework adds `InternalServerError` and `ServiceUnavailable` to every operation and puts the failure boundary around each handler: a retryable failure, such as a `SqlError` from a lost connection or a deadlock, answers `ServiceUnavailable`, and any other failure outside the operation's rejections, such as a constraint violation `run` does not map, answers `InternalServerError`. A stale write to a versioned repository, such as the notes `update` and `delete` operations make, answers the shared `Conflict` without the operation mapping it.

A failure the person should see is an exported tagged error class that `run` raises, and the generated contract carries it. To refuse a second bookmark with the same title beside the title input, declare a field rejection in `model.ts` with `fieldRejection` from `@shivaedev/contract/rejection.ts`, built from the payload's fields:

```ts
export class TitleTaken extends Schema.TaggedError<TitleTaken>()("TitleTaken", fieldRejection(Fields)) {}
```

Then raise it from `run`:

```ts
export const Create = command("create", {
	payload: Fields,
	*run({ title }) {
		const repository = yield* BookmarksRepository;
		const { id: userId } = yield* SessionUser;
		if (Option.isSome(yield* repository.findOne({ where: { title, userId } }))) {
			return yield* new TitleTaken({ field: "title", message: "You already saved a bookmark with that title" });
		}
		return yield* repository.insert({ title, userId }).pipe(Effect.map(toItem));
	},
});
```

The generated wire lists `TitleTaken` as `create`'s rejection, and the form in step 7 shows its message under the title input. Keep the class in `model.ts`, not beside the operation: the generated file imports each rejection from the file that declares it, and the browser imports the generated file, so a class in an operation or module file would put server code in the browser bundle, which the build refuses.

A query that needs another rule than a signed-in session writes `readPolicy(payload, viewer)`, which returns an Effect of a boolean and may yield the module's services. A `get` query that only the bookmark's owner may open reads the row in its policy:

```ts
export const Get = query("get", {
	payload: ItemId,
	readPolicy: ({ id }, viewer) =>
		Effect.gen(function* () {
			const repository = yield* BookmarksRepository;
			const row = yield* repository.findOne({ where: { id } });
			return Option.exists(viewer, ({ id: viewerId }) => Option.exists(row, ({ userId }) => userId === viewerId));
		}),
	*run({ id }) {
		const repository = yield* BookmarksRepository;
		const row = yield* repository.findOne({ where: { id } });
		return yield* Option.match(row, {
			onNone: () => Effect.fail(new NotFound({ message: "Bookmark not found" })),
			onSome: (found) => Effect.succeed(toItem(found)),
		});
	},
});
```

`ItemId` is `Schema.Struct({ id: Schema.Number })` in `model.ts`, and `NotFound` comes from `@shivaedev/errors/taxonomy.ts`. The module's handler checks the policy before `run`, and a live subscription checks it again before each rerun; `false` answers `QueryReadDenied`, and a typed failure the policy raises joins the query's rejections. A denial tells the viewer the bookmark exists. The notes `get` query keeps `signedIn` and checks ownership in `run` through [`ownedNote`](../../examples/starter/src/modules/notes/server/owned.ts) instead, so another account's note answers `NotFound`, like a missing one. The [contract guide](../../packages/contract/README.md#query-policies-record-keys-and-buckets) describes policies that check permissions or hide existence.

## 5. Define the module and register it

`src/modules/bookmarks/Bookmarks.ts` defines the module with `defineModule` from `@shivaedev/contract/defineModule.ts`, as [`Notes.ts`](../../examples/starter/src/modules/notes/Notes.ts) does. It names the module `bookmarks`, lists `operations: [List, Create]`, with `Get` added when you write it, applies `AuthenticatedUser` from `@shivaedev/identity/middleware.ts` as `middleware` and passes `wire: bookmarksWire` from `#generated/modules/bookmarks/Bookmarks.ts`. It lists no services: the module's type carries every service the operations yield except those the middleware provides, such as `SessionUser`, and the server registration must provide them. `pnpm generate`, which the type check, tests, dev server and build run first, writes the wire and the browser contract from each `run`, and the compiler compares the wire with every `run` on each type check, so a stale file is an error on the module that names the operation.

The generator never loosens a type. When `run` returns something with no exact wire form, such as a `Map`, a class that is not an exported Schema class, or a row whose model holds a server-only field, or fails with something that has no `_tag`, it refuses the module with a message that names the operation, the type, where in the result it sits and what to write instead:

```text
refused.returnsMap: run returns Map<string, number> at success, which has no exact wire form; return a plain object, an array or a string-keyed record
```

Change `run` as the message says, for example by returning `toItem(row)` rather than the stored row; an operation has no `success` or `rejections` to state beside `run`. A refusal stops `pnpm generate`, the tests, the dev server and the build with the same message. The [build guide](../../packages/build/README.md#what-run-may-return) lists every type `run` may return.

`src/modules/bookmarks/server/registration.ts` registers the module with the host, as [the notes registration](../../examples/starter/src/modules/notes/server/registration.ts) does:

```ts
import type { AppModule } from "@shivaedev/server/AppModule.ts";
import { migrationsIn } from "@shivaedev/server/migrationsIn.ts";
import { Bookmarks } from "#modules/bookmarks/Bookmarks.ts";
import { BookmarksRepository } from "#modules/bookmarks/server/Repository.ts";

export const bookmarksRegistration = {
	migrations: migrationsIn(import.meta.dirname),
	module: Bookmarks,
	services: BookmarksRepository.layer,
} satisfies AppModule;
```

The host serves each operation from `module:` through the module's generated handlers, which check each query's read policy, run `run` and apply the failure boundary; the registration writes no handlers. The module already carries its name, so the registration gives none. `migrationsIn(import.meta.dirname)` loads the numbered files in the `migrations` folder beside the registration through `loadMigrationsIn` from `@shivaedev/sql/loadMigrationsIn.ts`, with Node's file system; a module without tables leaves `migrations` out. `services` provides what the operations yield, except the SQL client and the other services the host provides, and a module that yields nothing else leaves it out; `appModules` refuses the module list at compile time, naming the module, the operation and the service, when an operation yields a service no registration provides. Declare the registration with `satisfies AppModule`, so its type keeps the module's services. Optional fields add `admin`, `ports`, `queues` and `workers`: `admin` is the result of `registerAdmin`; `ports` is a Layer of default adapters, overridden by the composition's `replacements` Layer; for jobs, spread the `queues` and `workers` returned by `jobModule` onto the same registration.

`pnpm generate`, which the dev server, the tests and `pnpm typecheck` run first, finds every exported registration written `satisfies AppModule` and lists it in `src/generated/server/modules.ts` in path order, so `bookmarksRegistration` joins the list with no edit. Three shapes stop `generate` with a message that names the file and the fix: a registration typed `: AppModule` or cast `as AppModule`, an exported object that names `module`, or `group` and `handlers`, without `satisfies AppModule`, and a module's `server/registration.ts` that exports something but no registration the list finds, such as one built by a function call. [`src/server/modules.ts`](../../examples/starter/src/server/modules.ts) passes that list to `appModules` beside the foundation and does not change when a module is added; `appModules` combines the modules, services, migration loaders and the optional fields. Both application processes use this composition, and the foundation's server Jobs handlers receive the queues collected from these entries. The browser keeps its own payload schemas and bindings without importing server registrations.

## 6. Write the client module and its route

A module's client is its contracts and its screens, in one file. The command writes `client/module.tsx`, which exports `const bookmarksModule = clientModule({ bookmarks: Bookmarks }, (clients) => ({ routes: (root) => [...] }))` with `clientModule` from `@shivaedev/react/client/module.ts` and `Bookmarks` from the generated `#generated/modules/bookmarks/Bookmarks.ts`, and one signed-in `/bookmarks` route that renders `BookmarksScreen` from `client/Screen.tsx` with `clients.bookmarks`. Extend these two files toward [the notes client module](../../examples/starter/src/modules/notes/client/module.tsx) rather than adding a second module or screen. The record names the contracts the module's screens call, once, under the module's own names, and the callback receives a bound client for each, typed `ContractClient<typeof Bookmarks>` wherever a screen names it. The module writes no URL, registry or Effect: the application's one client connects to `/rpc` beside the page and binds a contract that two modules name once.

Its routes reach the client by closure. To have the loader read the list before the screen renders, declare the list once as `const list = queryRoute(() => clients.bookmarks.list.query())` from `@shivaedev/react/client/adapters/queryRoute.ts`, spread `list` into the generated `/bookmarks` route so the loader reads the list in the session's registry, pass the screen `list.useQuery()`, which reads the same query without naming it again, in place of its own `useQuery`, and give the route an error component. The generated route, like the notes parent route, declares `staticData: { signedIn: true }`, so the root route's guard, which react's `SessionApp` builds, sends a signed-out visitor to the router's `redirects.signedOut`, `/sign-in` with the requested location to return to; a list query that answers `Unauthorized` redirects there too, so the route names no sign-in target. Beside `routes`, a module can return `warm`, the queries the session keeps subscribed, `admin`, its admin pages, and `menu`, `overlays` and `footer` for the shell.

`pnpm generate` finds every exported `clientModule(...)` outside server code and lists it in `src/generated/client/modules.ts` in path order, so `bookmarksModule` joins the app with no edit; [`src/client/modules.ts`](../../examples/starter/src/client/modules.ts) passes that list to `clientApp` once. The session boundary mounts the module's bound live connection, so the list also refreshes after another session writes.

## 7. Build the form and screen

Add the form beside the generated `client/Screen.tsx`, following [the notes create form](../../examples/starter/src/modules/notes/client/Create.tsx), and render it from `BookmarksScreen`. Import `useCreate` from `@shivaedev/react/client/create.ts` and `useField` from `@shivaedev/form/react.ts`. Call `useCreate(client.create, { initialValues: { title: "" } })` with the screen's `client: ContractClient<typeof Bookmarks>`; the form's fields come from the command's payload. Bind the title input to the field's value, change and blur handlers, and submit with `create.save()`.

Keep a label, the field's error and the pending button state. The form writes no failure handling: a blank or whitespace-only title shows "Enter a title" without a request, a `TitleTaken` rejection lands on the title field, a shared rejection, such as the `TooManyRequests` of the notes `create` operation's rate limit, shows its message through the application's notice host, and a lost connection or a server failure shows that host's one failure wording. A rejection the module declares for itself that names no field of the form needs a handler in `failures`, and the call does not compile without one; the [react guide](../../packages/react/README.md#failures-of-commands-and-saves) gives the rules. Follow [the notes screen](../../examples/starter/src/modules/notes/client/Screen.tsx), which renders the state the route component reads with `list.useQuery()`. The repository's committed bucket announcement refreshes that list. Applications own the wording and layout; the form owns encoded input and submission state.

## 8. Call an outside API

Reach an outside API with the native HTTP client behind a port, following [the JSONPlaceholder source](../../examples/starter/src/modules/notes/server/jsonPlaceholder.ts). It implements the [NoteSource port](../../examples/starter/src/modules/notes/server/Source.ts), a native Effect service whose method returns a title or typed domain failures. The source's Layer uses `@shivaedev/http`'s `filterStatus` and `readBoundedJson` with the native HTTP client: check the status before reading a bounded, Schema-decoded body, then translate remote failures into the port's errors. The [`import` operation](../../examples/starter/src/modules/notes/server/Import.ts) yields the port, and [the module registration](../../examples/starter/src/modules/notes/server/registration.ts) provides the source Layer in `ports`. Calls through the native HTTP client are Effects, so they need no `adapters/` folder; only what Quality forbids outside it does, such as a library call that returns a Promise. The `import` command fetches a source title, then creates the note with `yield* Create.run({ title })`, so it reuses the create operation's persistence path. Keeping every piece inside the notes module lets `create-app --minimal` remove the whole example.

Prove the source through the application's story kit, as [the import stories](../../examples/starter/src/modules/notes/server/noteImport.spec.ts) do. [The notes kit](../../examples/starter/src/modules/notes/test-support/application.ts) acquires test-story's `fakeHttpService` and scopes `routeOutbound` to the outside API's hostname. The real authenticated RPC command, source and HTTP client run against that fake API. Cover a successful response, an error status and a malformed body; assert on the returned value or typed failure and that failed imports leave no note. Only independent pure mapping code gets a colocated `.unit.test.ts`; a unit test must not import `effect/http`, even indirectly. This source uses Schema decoding and a title projection, so there is no separate mapping module to test.

## 9. Prove the PostgreSQL host path

Write the module's tests as stories, following the [story-testing skill](../../packages/skills/skills/story-testing/SKILL.md). The command writes an application kit in `src/modules/bookmarks/test-support/application.ts`, in the shape of [the notes application kit](../../examples/starter/src/modules/notes/test-support/application.ts): it starts the real host from [`src/test-support/host.ts`](../../examples/starter/src/test-support/host.ts) in an isolated database, and its `signedIn` trait signs an account in. Its stories in `server/lifecycle.spec.ts` create a bookmark over HTTP, list it and read the stored titles through a kit readout to prove persistence, check that a second account cannot list the first account's bookmarks and that a visitor can neither create nor list, and keep a list open over the real WebSocket: it receives its owner's new bookmark, and another account's new bookmark sends it no update. Extend the kit's verbs and add stories as the module grows, as [`noteLifecycle.spec.ts`](../../examples/starter/src/modules/notes/server/noteLifecycle.spec.ts) does for notes. To replace a port, pass `replacements: Layer.succeed(MyPort, fake)` to `applicationHost` or `applicationWorker`; both accept one Layer for all replacement services. The queue client factory is the `JobsClientFactory` service from `@shivaedev/jobs/server/JobsClientFactory.ts`, so tests replace it with `Layer.succeed(JobsClientFactory, testing.clientFactory)` rather than adding a host option. The host merges replacements over real services before handing them to RPC handlers; the factory replacement also feeds module service and worker construction.

Follow [the notes migration kit](../../examples/starter/src/modules/notes/test-support/migration.ts) and [`notesMigration.spec.ts`](../../examples/starter/src/modules/notes/server/notesMigration.spec.ts) to check the new table's columns and PostgreSQL types on the foundation schema. Run against a dedicated PostgreSQL test database whose role can create disposable databases:

```sh
pnpm test src/modules/bookmarks/server
```

Set `TEST_DATABASE_URL` first; the generated `.env.local` already holds it. In this repository, `./script/update` prepares the shared database; run focused tests with `pnpm --filter <package> test <paths>` and set the package database URL listed in the [root README](../../README.md#development). Confirm the PostgreSQL tests ran: a skipped test supplies no persistence or host evidence.

## 10. Prove the DOM path

The command writes the screen kit in `src/modules/bookmarks/test-support/screen.ts` and its first story in `client/list.dom.spec.ts`. The kit opens `/bookmarks` for a signed-in account in the real app, against the real host in an isolated PostgreSQL database, and renders it in happy-dom; the story checks the heading and the empty list. Extend that kit and add stories to that file, as [the notes signed-in app kit](../../examples/starter/src/modules/notes/test-support/signedInApp.ts) and [its stories](../../examples/starter/src/modules/notes/client/signedInApp.dom.spec.ts) do: give the kit verbs that type a title and submit the form, then assert that a blank or whitespace-only title shows its message without sending a command, and that a successful creation shows the new bookmark in the list and clears the input. Like the server stories, the screen stories need `TEST_DATABASE_URL`.

```sh
pnpm test src/modules/bookmarks/client/list.dom.spec.ts
pnpm lint
pnpm typecheck
pnpm build
```

## Move an existing module to this shape

An application whose modules declare operations without `run`, group them with `contract` and serve them with a handler map moves one module at a time. The host serves both forms side by side: a defined module registers as `module:`, a contract served by hand-written handlers keeps its `group` plus `handlers` registration, and both sit in the same `modules` list, as the [server guide](../../packages/server/README.md#host-the-application) shows. The host refuses to start when a defined module's queries are served by any handler other than its generated ones, so all of a module's operations move together. Quality's `operations/old-form` rule reports each module still on the old form once, at its contract: move the module, or record the modules left with `pnpm baseline write --rule operations/old-form`, which records only this rule's findings, and each move lowers that count. For one module:

1. Write each operation as its own file under `server/`: the handler's body becomes `run`, and the declaration keeps only its `payload`. Drop `success` and `rejections`, which the generator derives, a `readPolicy` of `signedIn`, which is the default, and an `invalidates` that returns no keys, which is the default too. Keep `reads` and `invalidates` that name keys, and a policy that is not `signedIn`.
2. Return the public shape from `run`, such as `toItem(row)`. What `run` returns is what the browser receives; no success schema drops the fields a row carries beyond it.
3. Delete failure handling that existed only for the boundary. `InternalServerError` and `ServiceUnavailable` are on every operation and can no longer be listed, and the boundary answers a retryable `SqlError` itself, so `catchTag("SqlError", …)` and a `transact({ onSqlError })` that mapped every SQL failure go. A constraint violation that means something to the person stays mapped in `run`, with `mapSqlError` from `@shivaedev/sql/mapSqlError.ts` or a `catchTag`, as the [constraint guide](./constraint-errors.md) shows. A stale write to a versioned repository answers `Conflict` without a mapping.
4. Move what the generated file must import into `model.ts` or another file the operations import through a package import such as `#modules/bookmarks/model.ts`: rejection classes and payload schemas. The generator refuses such a value declared in the operation's own file or imported there by a relative path. The collections that `reads` and `invalidates` use may stay beside the operation, because the generated file copies no keys.
5. Let each operation yield what it needs. A service whose methods only forwarded to the repository has no callers once the operations yield the repository, and goes; a service with its own state or ports stays and is yielded the same way.
6. Write the module file with `defineModule`, under the contract's name and with its `middleware`, `subject` and `keyScope`. A module's RPC tags are its name and the operation's name joined by a dot, as a contract's are, so the client's calls keep their names.
7. Register it with `module:` in place of `group` and `handlers`, keeping `services` and `ports` for what the operations yield, and import the generated contract from `#generated/...` in client code in place of the shared contract.

A stream is always declared without `run`, so a module's stream stays in a `contract` of its own name, served by its hand-written handlers and registered as `group` plus `handlers` beside the defined module; every module and contract carries its own `<name>.$changes` subscription. While some modules still have old-form contracts that the browser imports, list their folders in `oldFormFolders` so the build's bundle check excuses them, and remove each entry with its module's move; the [build guide](../../packages/build/README.md#folders-still-on-the-old-operation-form) describes the option. A story kit that fakes a moved module serves its generated contract with `Notes.application.toLayer`, as [the notes screen kit's fake host](../../examples/starter/src/modules/notes/test-support/client.ts) does; the compiler then holds each fake handler to the success and rejections the operation's `run` admits.

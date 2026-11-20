# @shivaedev/contract

Write a feature's queries and commands once, as their payload and their `run`, and get the RPC boundary, its expected failures and its refresh keys from them. The operations become native Effect RPC definitions, and a client binding connects their dependency keys to native AtomRpc queries.

## Why you want this

A feature often repeats its inputs, results and errors on both sides of an RPC boundary, then separately wires which views a write should refresh. Those copies are easy to make disagree. Write each operation as the logic it runs and list it in a module; the result type, the failures and the services come from that logic:

```ts
import { Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";
import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { notesWire } from "#generated/modules/notes/Notes.ts";
import { NotesStore } from "./store.ts";

const notes = collection("notes", Schema.Number);

const List = query("list", {
	reads: () => [notes.list],
	*run() {
		return yield* (yield* NotesStore).titles();
	},
});
const Rename = command("rename", {
	invalidates: ({ id }) => [notes.item(id)],
	payload: { id: Schema.Number, title: Schema.String },
	*run({ id, title }) {
		yield* (yield* NotesStore).rename(id, title);
	},
});

export const Notes = defineModule({ name: "notes", operations: [List, Rename], wire: notesWire });
```

`Notes` is a native RPC group with `notes.list` and `notes.rename`, served by the operations themselves. Nothing restates what `list` returns or how `rename` fails: [`@shivaedev/build`](https://github.com/ShivaeDev/platform/tree/main/packages/build) writes those schemas from `run`'s types into `notesWire`, and the compiler checks them against `run` on every type check. When a bound rename succeeds, the note's key refreshes its readers and the list; an item query for another note keeps its result. Handlers, middleware and transport use Effect's own APIs.

## Using it

### How to think about it

An **operation** is a query or a command written as its `payload` schema and a generator `*run`. Everything else about its boundary is derived from `run`: what it returns, the tagged failures it raises, and the services it needs. A **query** listens on the keys its repository reads name, or on the keys it declares in `reads`; a **command** announces the keys its repository writes name, plus any it declares in `invalidates`. A **rejection** is an expected typed failure that `run` raises, such as a missing note or an invalid title. Middleware failures and RPC client failures remain separate parts of the native client's error type.

A **module** lists its operations with the services they may use and serves them without hand-written handlers. Types are erased, so the schemas the server encodes with and the browser decodes with must exist as values: the module's **wire** holds them, generated from `run`'s types, and the browser imports a **browser contract** generated beside it, which carries no `run`. A module is a native `RpcGroup`. Its RPC tags are the module name and operation name joined by a dot. A **binding** connects a module or contract to an existing `AtomRpc.Service`: queries get native query atoms and call Effects, while commands get call Effects that invalidate after success.

A **collection key** names a dependency. Its item key identifies one item; its list key identifies a list in that collection. Keys do not hold data. Native query atoms hold results, and native Reactivity asks matching queries to run again. Live subscriptions use those same keys to rerun each subscriber’s authorized query on the server and push its changed result.

An operation can also be declared without `run`, stating its `success` schema, its `rejections` and a command's `invalidates` by hand, and grouped with `contract`. That form is for a boundary served by hand-written handlers, as [operations declared without run](#operations-declared-without-run) describes; a feature of an application is written as a module.

### 1. Once per feature: operations and their module

#### An operation written as its payload and run

An operation is its business logic: a `payload` schema and a generator `*run`, with no `Effect.gen` wrapper. Its success, rejections, services and the read policy's failures are inferred from `run`:

```ts
import { Effect, Schema } from "effect";
import { command, query } from "@shivaedev/contract/operation.ts";
import { fieldRejection } from "@shivaedev/contract/rejection.ts";
import { NotesRepository, SessionUser } from "./services.ts";

export const NoteFields = Schema.Struct({ title: Schema.Trim.check(Schema.isNonEmpty({ message: "Enter a title" })) });
export class TitleTaken extends Schema.TaggedError<TitleTaken>()("TitleTaken", fieldRejection(NoteFields)) {}

export const Create = command("create", {
	payload: NoteFields,
	*run({ title }) {
		const repository = yield* NotesRepository;
		const { id: userId } = yield* SessionUser;
		if (title === "reserved") {
			return yield* new TitleTaken({ field: "title", message: "That title is reserved" });
		}
		return yield* repository.insert({ title, userId }).pipe(Effect.map(({ id }) => ({ id, title })));
	},
});

export const List = query("list", {
	*run() {
		const repository = yield* NotesRepository;
		const { id: userId } = yield* SessionUser;
		return yield* repository.findMany({ select: ["id", "title"], where: { userId } });
	},
});
```

Here `NotesRepository` is a `@shivaedev/sql` repository whose model marks `userId` as a bucket. Its insert announces the new row and its owner's bucket, so `Create` declares no `invalidates`, and `List` declares no `reads`: its `findMany` pins the owner's bucket, so the live list listens on it.

`Create.run` is an Effect-returning function, so another operation composes it with `yield* Create.run({ title })`, and `Create`'s services and failures join that operation's types. A query without `readPolicy` gets `signedIn`, at run time and in its type. It may declare `reads`, `serverReads` and `readsCollections` (which need a `permissionReadPolicy`); one that declares none listens on what its repository reads filter by, as [query policies, record keys and buckets](#query-policies-record-keys-and-buckets) explains. A payload-free operation omits `payload` and gets `Schema.Void`.

A command without `invalidates` announces no keys of its own. Its `invalidates` takes the decoded payload and returns keys; object keys are sorted, so `invalidates` is checked before `run` and cannot see `run`'s result. A command that must announce keys computed from what it did, such as the note it found by title or the people a move affected, contributes them from inside `run` with [`commandResult`](#server-only-command-keys).

An operation written this way states no `success` or `rejections`: its module's wire supplies both. On its own, outside a module, it is served with `Schema.Void` and only `InternalServerError` and `ServiceUnavailable`. Every operation written this way carries those two in its type and its rejection set. A stale versioned write is the one failure `run` answers for the operation: an `OptimisticConcurrencyError` from an `@shivaedev/sql` repository that reaches the end of `run` becomes the shared `Conflict`, with a message telling the person to refresh, so the operation's type, its generated wire and its client list `Conflict`. An operation that wants another answer catches `OptimisticConcurrencyError` itself, and inference carries what it raises instead. Nothing else adds `Conflict`: an operation that answers a constraint violation as a domain failure maps it by constraint name in `run`, and inference carries the result. A failure that states `isRetryable` (such as `SqlError`), `SchemaError` and `QueryReadDenied` are never rejections. Rejections are exported classes keyed by their `_tag`.

`run` must not return `any`, such as the result of `JSON.parse`, which would otherwise pass every check: such an operation is a compile error that names it and `RunReturnsAny` (decode the value with a schema, or type it). While the declaration form is still accepted, that error starts with "No overload matches this call" and its last line names the problem. Biome's `useYield` refuses a `*run` that yields nothing, so a `run` that needs no service still yields an Effect.

`failureKind(error)` from `@shivaedev/contract/failureKind.ts` sorts an operation's failure for its client: `"request"` for a shared request rejection (the `RequestRejection` type in `@shivaedev/errors/taxonomy.ts`), `"framework"` for a `ServerFailure`, an `RpcClientError` or the contract's own `MissingReadPolicy`, `MissingReadPolicies`, `QueryReadDenied` and `WebSocketRequired`, `"framework"` also for a failure without a string `_tag`, and `"app"` for any other tagged failure, which is a rejection the feature declared for itself. `AppRejection<E>` and `FrameworkFailure` are the matching types; `@shivaedev/react` requires a handler only for an `AppRejection`.

A field failure is an exported tagged class built from the payload's fields with `fieldRejection`, as `TitleTaken` above. `run` raises it with `yield* new TitleTaken({ field, message })`; `useCreate` and `useEditor` in `@shivaedev/react` place its message on that field, as `@shivaedev/form`'s `rejecting` does for a form used directly.

#### A module defined from its operations

A module lists its operations once, with the services they may use, and serves them without hand-written handlers:

```ts
import { Effect, Option, Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";
import { NotFound, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { CurrentViewer } from "@shivaedev/contract/readPolicy.ts";
import { fieldRejection } from "@shivaedev/contract/rejection.ts";
import { notesWire } from "#generated/modules/notes/notes.ts";
import { Caller, NotesStore, type StoredNote } from "./services.ts";

const notes = collection("notes", Schema.Number);
export const NoteFields = Schema.Struct({ title: Schema.String });
export class TitleTaken extends Schema.TaggedError<TitleTaken>()("TitleTaken", fieldRejection(NoteFields)) {}

const signedInUser = Effect.flatMap(CurrentViewer, (viewer) =>
	Option.match(viewer, {
		onNone: () => Effect.fail(new Unauthorized({ message: "Sign in first" })),
		onSome: ({ id }) => Effect.succeed(id),
	}),
);

function toNotes(stored: readonly StoredNote[]): readonly { readonly id: number; readonly title: string }[] {
	return stored.map(({ id, title }) => ({ id, title }));
}

export const Create = command("create", {
	payload: NoteFields,
	*run({ title }) {
		const store = yield* NotesStore;
		const owner = yield* signedInUser;
		const owned = yield* store.owned(owner);
		if (owned.some((note) => note.title === title)) {
			return yield* new TitleTaken({ field: "title", message: "You already have a note with that title" });
		}
		const { id } = yield* store.insert(title, owner);
		return { id, title };
	},
});

export const Get = query("get", {
	payload: { id: Schema.Number },
	readPolicy: ({ id }, viewer) =>
		Effect.gen(function* () {
			if (Option.isNone(viewer)) {
				return false;
			}
			const note = yield* (yield* NotesStore).find(id);
			return Option.exists(note, ({ owner }) => owner === viewer.value.id);
		}),
	reads: ({ id }) => [notes.item(id)],
	*run({ id }) {
		const note = yield* (yield* NotesStore).find(id);
		if (Option.isNone(note)) {
			return yield* new NotFound({ message: "Note not found" });
		}
		return { id: note.value.id, title: note.value.title };
	},
});

export const List = query("list", {
	reads: () => [notes.list],
	*run() {
		const store = yield* NotesStore;
		return toNotes(yield* store.owned(yield* signedInUser));
	},
});

export const Notes = defineModule({
	middleware: Caller,
	name: "notes",
	operations: [List, Get, Create],
	wire: notesWire,
});
```

Here `NotesStore` is an ordinary service, `StoredNote` the row it returns, and `Caller` an RPC middleware that sets the viewer. `defineModule` takes the operations written as payload and run, its `wire` (below), and optionally `middleware`, `subject` and `keyScope` as `contract` does. It returns the module's contract, so `bind`, `makeClient` and a host accept it as they accept any contract. Each of its RPCs carries the `DefinedModule` annotation from the same file with the module's name, so a host can tell a module's queries from a contract's. The module lists no services: its type carries, for each operation, the services that operation's `run` and read policy yield, less what its middleware and subject provide per call, and nothing reads them at run time. An operation that starts to yield another service changes only that operation. A definition without `wire` is a compile error that says the property is missing. Its generics check the definition on the `name` line, so the first line of the compiler's message names the operation and its problem, such as `OperationNameRepeated` when two operations share a name:

```
src/test-support/fixtures/invalid/moduleRepeatedName.ts(15,2): error TS2322: Type '"lists"' is not assignable to type '"lists" & NoInfer<OperationNameRepeated<"list">>'.
```

`moduleHandlers(Notes)` builds the module's handler Layer from its operations, and the Layer requires exactly the services the operations yield beyond the middleware and subject, here `NotesStore`, so serving it provides that service on the Layer:

```ts
import { Layer } from "effect";
import { moduleHandlers } from "@shivaedev/contract/moduleHandlers.ts";
import { Notes } from "./notes.ts";
import { NotesStoreLive } from "./store.ts";

export const NotesHandlers = moduleHandlers(Notes).pipe(Layer.provide(NotesStoreLive));
```

An application registers the module with the server instead, and the [server's `appModules`](https://github.com/ShivaeDev/platform/tree/main/packages/server#host-the-application) refuses a registration list that leaves a service unprovided, naming the module, the operation and the service.

Each operation runs in a span named after the module and the operation, such as `Notes.create`. A query's read policy is checked inside its handler before `run`, with the module's services, so a policy reads a repository directly, as `Get` does above; a live subscription to the query checks the same policy. Failures pass the RPC boundary from `@shivaedev/errors`: a rejection the wire lists reaches the client as itself, an unlisted failure that states `isRetryable` answers `ServiceUnavailable`, and anything else answers `InternalServerError`, for the policy of a live subscription too. A command without `invalidates` publishes only the keys its writes announce.

#### The wire and the browser's contract

Types are erased, so the success schema and rejection classes the server encodes with and the browser decodes with must exist as values. [`@shivaedev/build`](https://github.com/ShivaeDev/platform/tree/main/packages/build) writes them from each module's `run` types into one file per module under `src/generated/`, which stays out of Git; an application runs it as `pnpm generate`. The module file passes its wire, as `Notes` does above, and every operation is served with its wire entry's success and rejections, plus `InternalServerError` and `ServiceUnavailable`. A wire entry's success describes only the shape: its RPC carries `GeneratedSuccess` from `@shivaedev/errors/GeneratedSuccess.ts`, so the host neither collects sensitive names from it nor treats its fields as public. Mark a sensitive field on the server's model instead, as the [errors README](https://github.com/ShivaeDev/platform/tree/main/packages/errors#masking-secrets-in-failures) describes.

The file the generator writes exports the wire, the browser's contract built by `clientContract` from the wire, the copied payloads, `reads` and `invalidates`, and the module's name, middleware, subject and key scope, and it ends with a type-level assertion that the browser's contract and the server module have the same RPCs:

```ts
import { Schema } from "effect";
import { Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { clientContract } from "@shivaedev/contract/clientContract.ts";
import type { ClientMatchesModule } from "@shivaedev/contract/clientMatchesModule.ts";
import type { Notes as NotesModule } from "#modules/notes/notes.ts";
import { Caller, NoteFields, notes, TitleTaken } from "#modules/notes/model.ts";

const Note = Schema.Struct({ createdAt: Schema.Date, id: Schema.Number, title: Schema.String });

export const notesWire = {
	create: { rejections: { TitleTaken, Unauthorized }, success: Note },
	list: { rejections: { Unauthorized }, success: Schema.Array(Note) },
} as const;

export const Notes = clientContract({
	commands: { create: { invalidates: () => [notes.list] } },
	middleware: Caller,
	name: "notes",
	payloads: { create: NoteFields },
	queries: { list: { reads: () => [notes.list] } },
	wire: notesWire,
});

export const notesMatchModule: ClientMatchesModule<typeof Notes, typeof NotesModule> = true;
```

`clientContract` requires a wire entry for every query and command it declares. The browser imports `Notes` from that file and binds it like any contract; it carries no `run`, read policy or service, and its import graph reaches no server code. A command's `invalidates` and a query's `reads` work in the browser exactly as on the server. Over RPC's JSON serialization, a `Schema.Date` field arrives as a `Date` equal to the one `run` returned, and a rejection the wire lists arrives as its class. Neither the browser's contract nor an operation without a read policy can be served: `contract()` requires one on every query, and a host refuses a query without one at start-up.

The compiler compares the wire with `run` on every type check, and a stale file is an error on the module's `name` line that names the operation, one problem per operation: `WireSuccessStale` when the entry's success differs from what `run` returns, `WireRejectionsStale` when its rejection tags or classes differ from what `run` and a query's read policy raise, other than infrastructure failures, and `OperationMissingFromWire` when an operation has no entry and its `run` returns a value or raises a rejection. A success differs when its type and `run`'s return type are not mutually assignable; when they differ only in array mutability, because `Schema.Array` decodes a readonly array; when an object that `run` returns and a `Schema.Struct` that the success holds in the same position, at the top or in an array, struct field, tuple, record, union or `Option`, have different keys, such as an optional property only one of them has, which the `Struct` would drop or never send; and when the success holds a `Schema.Class` in such a position and `run` returns something other than that class there, such as an object literal of its fields, which fails to encode. Rejections differ when `run` raises a tag the entry does not list, the entry lists a tag nothing raises or one of the automatic two, or a listed class and the class `run` raises under the same tag differ in shape, such as a local `NotFound` with other fields than the shared one.

TypeScript compares classes by shape, so two cases still compile: a rejection class whose twin of the same shape is what `run` raises, and a helper typed to return a readonly interface of the same shape where the success is a `Schema.Class`. Neither is silent at run time: the twin is not the listed class, so the boundary answers `InternalServerError` and reports it, and the plain object fails to encode. The generator resolves both by declaration. A `Schema.Struct` behind another schema, such as a transformation, a brand or `Schema.suspend`, is compared with `run` only by mutual assignability, so an optional property that only one side has still compiles there and is dropped or never sent.

The browser's assertion fails with `ClientDiffersFromModule`, naming the operations whose RPCs differ. `ClientMatchesModule` compares the operations' payloads, successes and rejections; a stale copy of a query's `reads`, a command's `invalidates` or the key scope in the generated file still compiles; the generator keeps those current, because a change to them makes `shivaedev-build generate --check` report the file stale. A stale wire and a stale browser contract read:

```
src/test-support/fixtures/invalid/moduleStaleRejection.ts(9,2): error TS2322: Type '"staleRejection"' is not assignable to type '"staleRejection" & NoInfer<WireRejectionsStale<"create", "the generated file is stale; run pnpm generate", "TitleTaken" | "Unauthorized", "Unauthorized">>'.
src/test-support/fixtures/invalid/staleNotes.ts(17,14): error TS2322: Type 'boolean' is not assignable to type 'ClientDiffersFromModule<"create", "the generated file is stale; run pnpm generate">'.
```

### Operations declared without run

A boundary served by hand-written handlers, such as a contract a native `RpcServer` hosts with `toLayer`, declares each operation without `run`: its `success` schema, its `rejections` and, for a command, the keys it `invalidates`. `contract` groups such operations into a native `RpcGroup`. A **stream** is always declared this way: it declares an element schema in `success`, typed rejections and the keys it reads, and its handler returns a native `Stream`. The sections that follow host and bind this declaration; a module serves itself with `moduleHandlers` and binds the same way.

Keep the shared declaration in a module that both server and client can import:

```ts
import { Effect, Schema } from "effect";
import { contract } from "@shivaedev/contract/contract.ts";
import { collection } from "@shivaedev/changes/keys.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { fieldRejection } from "@shivaedev/contract/rejection.ts";

export class Note extends Schema.Class<Note>("Note")({
	body: Schema.String,
	id: Schema.Number,
	title: Schema.String,
}) {}
export const Draft = Schema.Struct({ body: Schema.String, title: Schema.String });
export class NoteMissing extends Schema.TaggedError<NoteMissing>()("NoteMissing", { id: Schema.Number }) {}
export const notes = collection("notes", Note.fields.id);

export const Get = query("get", {
	readPolicy: () => Effect.succeed(true),
	payload: { id: Schema.Number },
	success: Note,
	rejections: { NoteMissing },
	reads: ({ id }) => [notes.item(id)],
});
export const List = query("list", {
	readPolicy: () => Effect.succeed(true),
	success: Schema.Array(Note),
	reads: () => [notes.list],
});
export const Rename = command("rename", {
	payload: { id: Schema.Number, title: Schema.String },
	success: Note,
	rejections: { NoteMissing, Invalid: fieldRejection(Draft, ["title"]) },
	invalidates: ({ id }) => [notes.item(id)],
});
export const Create = command("create", {
	payload: Draft,
	success: Note,
	rejections: { Invalid: fieldRejection(Draft) },
	invalidates: (_draft, note) => [notes.item(note.id)],
});
export const Notes = contract("notes", { queries: [Get, List], commands: [Rename, Create] });
```

Save this module as `notes.ts`. The payload can be struct fields, as in `Get`, or a schema, as in `Create`. An omitted payload or success is `Schema.Void`; no declared rejections gives `Schema.Never`. A declared query requires `readPolicy`, and a declared command requires `invalidates`. The server resolves `reads` with the decoded payload and session viewer. For local command dependencies, the browser also evaluates it with `Option.none()`; return no viewer keys for that case. Authorized subscription scopes always come from the server. A declared command's `invalidates` receives the decoded payload, successful result and optional session viewer, so a create call can invalidate the ID the server assigned.

The collection's ID schema gives `item` its ID type. Here, `notes.item` takes a number. Query and command callbacks retain their payload and result types, including when the operations are declared inline inside `contract`.

Operation names must differ within a contract, including across queries, commands and streams. Literal duplicate declarations fail compilation. If the compiler cannot see the names in an array, the server reports duplicate names as an Effect defect while validating the contract during host startup.

The native RPC mapping types `OperationRpc` and `Tag` are exported from `@shivaedev/contract/operationRpc.ts`.

### Whose account a request acts on

Set `subject` on a contract to a browser-safe declaration from `@shivaedev/identity/subject.ts`: `selfSubject` selects the session account; `accountSubject({ permission, refusal, deny })` permits another account only with the permission's `any` grant. `delegatedSubject({ service, refusal, deny })` asks the application's rule per call, with a `kind` of `read` for queries and streams or `write` for commands. A contract's `declaration.subject` records the declaration it names. The declaration applies to the application RPCs and their changes stream. Native middleware carries its typed failures and supplies the branded `Subject` service to handlers and the application services they call. Business payloads need no owner id.

```ts
import { contract } from "@shivaedev/contract/contract.ts";
import { command } from "@shivaedev/contract/operation.ts";
import { selfSubject } from "@shivaedev/identity/subject.ts";

const Save = command("save", { invalidates: () => [] });
export const Account = contract("account", { commands: [Save], subject: selfSubject });
```

Contracts with declared subjects can be exported from published packages with TypeScript declaration output. The client calls `account.save` without an account id. For a delegated subject, the client names the account per call: a bound query takes `subject` in its options and a query's, command's or stream's `run` takes `{ subject }` as its second argument, as in `api.title.query(undefined, { subject: "bob" })` and `api.rename.run({ title }, { subject: "bob" })`. The option sets the call's `x-platform-subject` message header, so one client and its one socket serve the actor's own data and any number of subjects, each live query keeping its own subject on its changes stream. Queries with different subjects are different atoms, keep separate retained results, and serialize under separate keys when they share a `serializationKey`. The session host installs the resolver; handlers read `Subject` from the request environment. See [identity's subject guide](https://github.com/ShivaeDev/platform/tree/main/packages/identity#declared-request-subjects) for delegated selection and refusal declarations.

### Expected failures

Import the shared expected failures from `@shivaedev/errors/taxonomy.ts`: `NotFound`, `Unauthorized`, `Forbidden`, `BadRequest`, `Conflict`, `PreconditionFailed`, `TooManyRequests`, `AuthUnavailable`, `InternalServerError` and `ServiceUnavailable`. Each class is a tagged error schema with a string `message`; `BadRequest` and `Conflict` also accept an optional string `field`. Declare only the failures an operation can return:

```ts
import { Effect, Schema } from "effect";
import { Rpc } from "effect/rpc";
import { BadRequest, Conflict } from "@shivaedev/errors/taxonomy.ts";

export const Rename = Rpc.make("Rename", {
	error: Schema.Union([BadRequest, Conflict]),
	payload: { name: Schema.String },
	success: Schema.String,
});
```

A handler fails with `new Conflict({ field: "name", message: "Name is taken" })`. Native RPC JSON decodes the rejection back to the error instance with its field. Taxonomy errors can be declared on an RPC with no authentication middleware. [`@shivaedev/errors`](https://github.com/ShivaeDev/platform/tree/main/packages/errors#readme) also exports `rejectedField`, which reads the field and message of a rejection on the client.

For a bound command declaring `BadRequest`, payload construction or encoding failures become that declared rejection in the Effect error channel. Its `message` contains the schema's validation details, including struct-level checks. The invalid payload does not reach the handler. Commands without a declared `BadRequest` keep native RPC's failure behavior.

`rejections: { NoteMissing }` reuses the class. The object's key must equal the class's `_tag`. Sharing a class lets a service and several operations use the same expected failure.

`rejections: { Invalid: fieldRejection(Draft) }` generates a tagged error class for that operation. `fieldRejection` derives the allowed field names from the struct; an explicit field list narrows them. `Rename` permits only `"title"`, while `Create` permits `"body"` or `"title"`. Their generated `Invalid` classes are distinct.

```ts
const invalid = new Rename.Rejection.Invalid({ field: "title", message: "Enter a title" });
const refused = Rename.reject.Invalid({ field: "title", message: "Enter a title" });
const missing = Get.reject.NoteMissing({ id: 9 });
```

`invalid` is the generated class instance. `refused` and `missing` are failed Effects, with the corresponding rejection in their error channel. Each operation also exposes `payload`, `success` and `error`, so another boundary can use its schemas directly. A handler may fail with its declared rejections or with an error that one of the contract's RPC middleware declares, as native `Rpc` handlers do; failing with any other error fails compilation.

### 2. Once per host: native handlers and transport

Implement the contract with native `of` and `toLayer`:

```ts
import { Effect, Ref, Stream } from "effect";
import { Create, Get, Note, Notes, Rename } from "./notes.ts";

export const NotesHandlers = Notes.toLayer(
	Effect.gen(function* () {
		const stored = yield* Ref.make(
			new Map([
				[1, new Note({ body: "", id: 1, title: "One" })],
				[2, new Note({ body: "", id: 2, title: "Two" })],
			]),
		);
		const find = (id: number) =>
			Effect.flatMap(Ref.get(stored), (all) => {
				const note = all.get(id);
				return note === undefined ? Get.reject.NoteMissing({ id }) : Effect.succeed(note);
			});
		const save = (note: Note) => Ref.update(stored, (all) => new Map([...all, [note.id, note]])).pipe(Effect.as(note));
		return Notes.of({
			"notes.$changes": () => Stream.never,
			"notes.get": ({ id }) => find(id),
			"notes.list": () => Effect.map(Ref.get(stored), (all) => [...all.values()]),
			"notes.rename": ({ id, title }) =>
				title.trim() === ""
					? Rename.reject.Invalid({ field: "title", message: "Enter a title" })
					: Effect.flatMap(find(id), (note) => save(new Note({ ...note, title }))),
			"notes.create": (draft) =>
				draft.title === ""
					? Create.reject.Invalid({ field: "title", message: "Enter a title" })
					: Effect.flatMap(Ref.get(stored), (all) => save(new Note({ id: all.size + 1, ...draft }))),
		});
	}),
);
```

Save this module as `handlers.ts`. An application can put repository and service calls in these handlers. The contract checks handler result and rejection types; it does not implement persistence, authorization or transactions. This in-memory server keeps the reserved change stream open without publishing hints. When a Platform host supplies that handler, build application handlers from `Notes.application` and keep `Notes` as the host and client group.

To map unexpected failures once for a handler registration, use `rpcBoundaryHandlers(Notes.application, options, handlers)` from [`@shivaedev/errors`](https://github.com/ShivaeDev/platform/tree/main/packages/errors#mapping-unexpected-failures-at-the-handler-edge), then pass the map to `Notes.application.toLayer`. The helper derives each operation's rejection schema independently, and every operation declares the fallback returned by `options.unexpected`. Payloads, successful results and required services retain their native types.

Native `.middleware(M)` returns a contract that retains its declarations. For example, a native middleware service can supply request identity:

```ts
import { Context, Schema } from "effect";
import { RpcMiddleware } from "effect/rpc";
import { Notes } from "./notes.ts";

class Session extends Context.Service<Session, { readonly user: string }>()("app/Session") {}
class Denied extends Schema.TaggedError<Denied>()("Denied", {}) {}
class Guard extends RpcMiddleware.Service<Guard, { provides: Session }>()("app/Guard", { error: Denied }) {}
const SecuredNotes = Notes.middleware(Guard);
```

The host supplies the middleware implementation and request policy. Native middleware failures join the client's failure type. The [`platform` request-context guide](https://github.com/ShivaeDev/platform/blob/main/docs/framework/request-context.md) explains the shared identity and server boundary.

For an ordinary HTTP server, compose the contract with native layers:

```ts
import { Layer } from "effect";
import { RpcSerialization, RpcServer } from "effect/rpc";
import { Notes } from "./notes.ts";
import { NotesHandlers } from "./handlers.ts";

export const NotesRoutes = RpcServer.layerHttp({ group: Notes, path: "/rpc", protocol: "http" }).pipe(
	Layer.provide([NotesHandlers, RpcSerialization.layerJson]),
);
```

The server host provides `NotesRoutes` to its native HTTP router. In a separate client module, use the same contract:

```ts
import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { bind } from "@shivaedev/contract/bind.ts";
import { Notes } from "./notes.ts";

export class NotesClient extends AtomRpc.Service<NotesClient>()("app/NotesClient", {
	group: Notes,
	protocol: RpcClient.layerProtocolHttp({ url: "http://127.0.0.1:3000/rpc" }).pipe(
		Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson]),
	),
}) {}
export const api = bind(Notes, NotesClient, { live: false });
```

Save the client module as `client.ts`. The [native RPC guide](https://github.com/ShivaeDev/platform/blob/main/docs/framework/native-rpc.md) covers hosting; the [reference composition](https://github.com/ShivaeDev/platform/blob/main/docs/framework/composed-example.md) composes handlers, request identity, SQL and a rendered client.

### Build a shared WebSocket client

Use `makeClient` once per session to build a native AtomRpc client and bind the contract. Clients for the same identified session, URL and upgrade options share Effect RPC's socket protocol, including when they bind different contracts or use independent registries.

```ts
import { makeClient } from "@shivaedev/contract/bind.ts";
import { Notes } from "./notes.ts";

const { api, runtime } = makeClient(Notes, {
	url: new URL("/rpc", window.location.href).href,
});
const note = api.get.query({ id: 1 });
const rename = runtime.fn(api.rename.run);
```

Browsers send the session cookie at upgrade. Mounting a query opens its subscription before running its first authorized read; unmounting cancels that subscription without restarting the socket or another query. Changed keys rerun only their readers, and equal results retain the bound atom's value. Connection failures use Effect RPC's reconnect backoff; subscriptions reopen and the server pushes current results because there is no retained key history. `LiveConnection.status` reports `connecting`, `live` or `reconnecting`.

On visible `visibilitychange`, `online` and `pageshow` events, or an injected native resume, the default socket client probes an open connection with RPC Ping/Pong. Commands wait during that probe. A missing Pong after 2.5 seconds fails the socket reader and starts native reconnection without waiting for a browser close handshake. Bound commands issued during reconnection wait up to 10 seconds before sending; a timeout fails with a typed `RpcClientError` whose reason is `SocketOpenError` with kind `Timeout`. A held command immediately reports `waiting-for-connection` through `clientActivity(client)`, including without a mounted query. Only commands that have not been sent wait; in-flight commands fail on disconnect and are never replayed. Supplied native socket protocols inherit the command wait through Effect’s connection hooks without additional wiring.

`SocketClock` from `@shivaedev/contract/SocketClock.ts` supplies the default client’s network deadlines independently of application time. It defaults to the real Clock; provide another native Clock in the client runtime or client Layer to control socket and connection-wait time in stories.

For a native WebView, pass the signed session credential as `bearerToken` to `makeClient`. The browser WebSocket constructor needs no upgrade headers. The client adds `auth=frame` to the RPC URL and sends `{"_tag":"Authenticate","token":"<credential>"}` as its first text frame on every connection, before native RPC traffic. The bearer never enters the URL. Use a host session provider that admits bearer sessions and configure the WebView's Origin on the host. Authentication failures close the socket with code 1008 and reason `Authentication required`; an unavailable session provider closes it with code 1011 and reason `Authentication unavailable`. Sign-out or session expiry also closes an established bearer socket. Pass a native `resume` source to `makeClient` as shown below to reconcile live reads when the shell resumes.

`group` supplies a larger native RPC group containing the contract, such as an admin registry. The result is a native client Layer for `ManagedRuntime.make`, plus the native `Client` service, atom `runtime` and scoped `client` Effect. Session-scoped contracts require `registry`. For Node clients, supply upgrade `headers` and `webSocketConstructor: NodeWS.layerWebSocketConstructor` from `@effect/platform-node`. A native `protocol` Layer selects another transport explicitly. A `protocol: (identity) => layer` factory follows the live session identity instead: the client rebuilds its transport when that identity changes. The scoped `client` Effect uses `undefined` as the factory identity. Return a shared Layer for clients that should share a socket within one session. Use `live: false` for ordinary clients without subscriptions.

### 3. Every day: read and change

```ts
const one = api.get.query({ id: 1 });
const list = api.list.query();
const readOnce = api.get.run({ id: 1 });
const rename = api.rename.run({ id: 1, title: "Uno" });
```

`one` and `list` are native query atoms. `readOnce` and `rename` are Effects for individual calls. A query's Effect requires `NotesClient`; a command's Effect also requires native `Reactivity`. Commands expose `run`, the atom `runtime` that provides those services and their declared `payload` schema, and have no `query` member; queries and streams also carry `runtime`. React's action and form hooks take a bound command as it is, as in `useAction(api.rename)`, and a form derives its fields from `payload`.

Mount the atoms and run commands through the service's atom runtime in the same registry:

```ts
import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { api, NotesClient } from "./client.ts";

const registry = AtomRegistry.make();
const one = api.get.query({ id: 1 });
const list = api.list.query();
const releaseOne = registry.mount(one);
const releaseList = registry.mount(list);

const renamed = await Effect.runPromise(AtomRegistry.getResult(registry, NotesClient.runtime.atom(api.rename.run({ id: 1, title: "Uno" }))));

releaseOne();
releaseList();
registry.dispose();
```

The successful rename invalidates note 1 and the list in the browser, and because this client is bound with `live: false`, that invalidation refreshes both queries. A rejected rename invalidates neither. Bound queries and commands take the schema's decoded payload type; native clients take its constructor input, which can differ when a field has a constructor default. Result and failure types preserve operation rejections, middleware errors and `RpcClientError`.

The dependency rule is deliberately asymmetric:

| Declared key    | Query reads | Successful command invalidates |
| --------------- | ----------- | ------------------------------ |
| `notes.item(1)` | `"notes:1"` | `"notes:1"` and `"notes"`      |
| `notes.list`    | `"notes"`   | `"notes"`                      |

`readKeys` and `invalidationKeys` from `@shivaedev/changes/keys.ts` produce these native keys and remove duplicates. An item change reaches readers of that item and its list, preserving other item queries. A list-only invalidation reaches list readers and leaves item queries alone. These keys match native Reactivity's record-key hashing of `{ notes: [1] }`.

The browser invalidates a command's keys after RPC success, together with a key of the command's contract. That local invalidation refreshes queries bound with `live: false`. A query with no keys in the browser, because it leaves out `reads` or its `reads` returns none for `Option.none()`, listens on that contract key instead, so bound with `live: false` it refreshes after every successful command of its contract on that client, including a command that declares no keys. A live bound query, the default on database hosts, gets its refresh from the server push instead: the server reruns it when the command's keys are published there, and the local invalidation only retries its subscription after that subscription failed with something other than `QueryReadDenied` ([Server-pushed live queries](#4-server-pushed-live-queries)). Database hosts from `@shivaedev/server` publish declared command invalidations on the server after the handler succeeds, excluding keys already announced by repository commits, using `transact` from [`sql`](https://github.com/ShivaeDev/platform/tree/main/packages/sql); commit-bound changes belong to [`changes`](https://github.com/ShivaeDev/platform/tree/main/packages/changes).

#### Server-only command keys

When the affected keys depend on what the command did, such as the note it found or the people a move affected, return the success through `commandResult`: from inside a command's `run`, or from a declared command's server handler. Its `invalidates` keys join the command's declared keys at the command guard. Only `result` becomes the RPC success; the extra keys and the audience used to find them stay on the server. In a module, the note a command found by its title announces itself this way:

```ts
import { commandResult } from "@shivaedev/contract/commandResult.ts";

export const Touch = command("touch", {
	payload: NoteFields,
	*run({ title }) {
		const store = yield* NotesStore;
		const note = (yield* store.owned(yield* signedInUser)).find((owned) => owned.title === title);
		if (note === undefined) {
			return yield* new NotFound({ message: "Note not found" });
		}
		return yield* commandResult({ invalidates: [notes.item(note.id)], result: { id: note.id, title: note.title } });
	},
});
```

A handler of a declared command does the same around its write:

```ts
import { commandResult } from "@shivaedev/contract/commandResult.ts";

const move = ({ id, household }) =>
	Effect.gen(function* () {
		const before = yield* audienceFor(id);
		const pot = yield* movePot(id, household);
		const after = yield* audienceFor(id);
		return yield* commandResult({
			result: pot,
			invalidates: [...before, ...after].map((viewerId) => pots.bucket.viewerId(viewerId)),
		});
	}).pipe(transact({ onSqlError: (error) => error }));
```

Here `audienceFor` reads household members and people who ate from the pot from the application's database, `movePot` performs the write, and `pots` declares a `viewerId` bucket. Read the audience after the write to include new readers, and retain the old audience when the write removes access. Each viewer's list reads its own bucket. Keep these reads and the write in the same transaction when they must describe one change.

Use this helper in hosts from `@shivaedev/server`, or a native RPC host wired with `guardCommands` and `commandGuardLayer`. Keys are isolated per command, deduplicated with declared keys, and published through the existing `@shivaedev/changes` command publication boundary after success. A failed handler discards them. They do not enter the browser's pure `invalidates` callback; live subscriptions receive the server’s changed query results.

#### When a command's change is on the screen

A command's reply arrives before the live queries it changed are updated. A command run through a client from `makeClient` passes through three states in order: `sent` when it leaves, `accepted` when its success reply arrives, and `reflected` when every live query open on the same connection shows the server's state after the command. A failed command stops at `sent`: its failure is the Effect's error and nothing waits. `run` completes at `accepted`. Wrap it with `untilReflected` to complete at `reflected`:

```ts
import { untilReflected } from "@shivaedev/contract/commandSignal.ts";

const renamed = untilReflected(api.rename.run({ id: 1, title: "Uno" }));
```

To follow each state, provide `CommandSignal` from the same module to the command's Effect, a function that receives `"sent"`, `"accepted"` and `"reflected"` as they happen. The client applies no optimistic update; `reflected` reports what the server pushed.

`sync` on the value `makeClient` returns is an Effect that writes nothing and waits the same way. It completes once every open live query shows the changes committed before it, including writes of other clients through other hosts. Use it to wait for a write this client did not make.

```ts
import { makeClient } from "@shivaedev/contract/bind.ts";

const client = makeClient(Notes, { url: "/rpc" });
const current = client.sync;
```

The wait rests on a sync token. The client names itself on each live stream and numbers each command. When the handler has finished, the host sends that number on the change channel behind the command's keys, and each stream of that client confirms it after the reruns queued ahead of it. The rules that follow from this:

- A command that publishes nothing is reflected when its token returns. It waits for no update.
- The token leaves after the handler's last commit, so a command that commits several transactions is reflected after the last one's update. Work the command starts for later, such as a job, is not covered: `reflected` says nothing about writes made after the handler returned.
- A query opened while the command was in flight, and a query reopened by a reconnect, may have missed the token. The client then sends a sync of its own once that stream is open, and the command is reflected when the stream has its first result and that sync returns.
- While the `paused` atom is set, a command stays `accepted`. It is reflected when live queries resume and their reopened streams catch up.
- When the host's change listener was down, the token is lost. The listener's recovery resyncs every stream, which makes the client sync again, and that releases the wait.
- A host from before sync tokens never confirms one. The client sees that on the stream's first frame and stops waiting for that query, so against such a host a command is reflected as soon as it is accepted. A client built with a custom `protocol` sends no number on its commands and syncs after each reply instead; when that sync fails, the waits it covered end.
- Only a stream that names its client receives the confirmation frames. Other clients and other viewers receive the same results as before.
- A host confirms a token only on the streams of the client it names. The number is no secret: a guessed token can at most end that one client's wait early.

### Host build announcements

`HostVersion` from `@shivaedev/contract/HostVersion.ts` declares the native `platform.hostVersion.watch` string stream shared by the application host and React's deploy controller. The host announces its configured build ID on subscription, including after a host replacement reconnects. It uses the same shared WebSocket connection as other `makeClient` bindings with matching transport options. Applications normally use the controller from `@shivaedev/react/client/deployUpdate.ts` rather than consuming this stream directly.

### Client activity

`clientActivity(client)` from `@shivaedev/contract/clientActivity.ts` returns a native Effect `Stream` with a `current` Effect for a client made by `makeClient`. Its state includes `connectionStatus`, a `"live" | "reconnecting" | "waiting-for-connection"` value aggregated across mounted queries from all bindings of the same client service, with live subscription changes debounced for 300 ms on the client runtime’s Clock and held commands reported immediately. Refused subscriptions do not count as reconnecting. The stream also exposes its native `connectionStatus` atom for React readers.

The state's `firstSettled` flag is `false` until a mounted query has delivered its first success or failure and, with that, no mounted query awaits a first result and no command is in flight. It then stays `true` for that client: a later command or a newly mounted query does not turn it back, and a client that mounts no query never turns it on. The stream exposes it as its native `firstSettled` atom, which React reads through `useFirstSettled`.

For screen stories, pass `activityScreenSignal(clientActivity(client))` to a test-story screen driver's `activity` option. By default, `settle()` waits for commands until they are reflected and for the first result of each mounted query, then flushes the renderer. Contract identifies commands from its own RPC annotations; kits need no query-name exceptions. The activity state's `commands` count includes commands held for a connection, `unreflectedCommands` counts commands from the moment they are sent until they are reflected or fail, and `initialQueries` counts mounted queries until their first success or failure. Unmounting releases that query's pending activity. `isClientSettled(state)` checks these three counts. An open live query that has delivered its first result, including one awaiting a later refresh, does not keep a screen story pending.

`activityScreenSignal(activity)` projects the stream and its `current` Effect into `{ pending, connectionStatus }`. The returned shape is structural and carries no test-story dependency. Stories that wait for a write their client did not make pass `screenSync(client, registry)` from `screenSync.ts` as the driver's `sync` option: it runs the client's `sync` through the view's registry, and the driver's `sync()` settles the screen after it. `isClientIdle(state)` retains the full finite-work check: `rpcCalls` for finite calls, `refreshingAtoms` for mounted query atoms awaiting values must all be zero. Long-lived subscription streams and server reruns themselves do not count as finite calls.

### Query completion

`querySignals(query)` from `@shivaedev/contract/querySignals.ts` returns a native atom scoped to the query's registry. Its `completed` counter advances when the initial query or a refresh finishes, including typed failures and equal results. `pending` describes the query result awaiting completion. `subscription` is `disabled` for an ordinary query, `opening` while connecting, `open` once accepted, or `refused` after a terminal refusal. Read the query's `AsyncResult` for its value or typed failure.

```ts
import { querySignals } from "@shivaedev/contract/querySignals.ts";

const signals = querySignals(one);
const before = registry.get(signals).completed;
const completions = AtomRegistry.toStream(registry, signals);
```

Mount the query to start it. Wait on `completions` for `completed > before` after an action that refreshes it; compare the counter rather than the result's identity. A server-pushed equal result completes without changing the visible value. Raw `$changes` consumers receive an `Unchanged` update with `queryIndex` for these completed reads. Clients and servers must understand the same stream schema.

### Session-owned keys

A self-only feature, such as a user's preferences, reads and changes only the signed-in account's records. Declare its contract with `keyScope: "session"` and let its handlers read the account from request-local identity, so payloads carry no owner field, and reads and invalidations name a logical item key for the record:

```ts
const preferences = collection("preferences", Schema.String);
const Preferences = contract("preferences", {
	keyScope: "session",
	queries: [
		query("self", {
			readPolicy: signedIn,
			reads: () => [preferences.item("self")],
			success: Schema.String,
		}),
	],
	commands: [
		command("save", {
			payload: { title: Schema.String },
			invalidates: () => [preferences.item("self")],
			success: Schema.String,
		}),
	],
}).middleware(Authenticated);

const api = bind(Preferences, Client, { registry });
const self = api.self.query(undefined);
const save = api.save.run({ title: "My preferences" });
```

The examples use `Schema` and `Effect` from `effect`, `contract`, `query`, `command` and `bind` from contract's defining modules, `collection` from `@shivaedev/changes/keys.ts`, and `Authenticated` from `@shivaedev/identity/middleware.ts`. `Client` is the application's native AtomRpc service, and `registry` is the atom registry that owns the session's queries. In React, `SessionBoundary` supplies that registry to `connect`, as [react's session-scoped bindings](https://github.com/ShivaeDev/platform/blob/main/packages/react/README.md#session-scoped-bindings) show.

Handlers read the account from request-local `Identity`, imported from `@shivaedev/identity/identity.ts`:

```ts
Preferences.application.toLayer({
	"preferences.self": () => Effect.flatMap(Identity, ({ id }) => store.read(id)),
	"preferences.save": ({ title }) => Effect.flatMap(Identity, ({ id }) => store.save(id, title)),
});
```

`store` is the application's persistence service. No owner or client key scope is accepted from a request. The database app host uses plain repository keys for every subscriber and rechecks each subscriber’s read policy before delivery.

The registry is required for session-scoped bindings. Query atoms and live connections belong in it; command and one-off query Effects execute through it. Explicit streams also run through its client, preserving the session transport and headers; disposing the registry ends those streams. Streams on ordinary contracts use the caller's client. A successful command invalidates its registry's prefixed keys, while a rejected command declares no invalidation. Ordinary contracts keep unscoped keys and the two-argument `bind` call.

Server subscriptions and committed writes use the same plain record, list and bucket keys, including for `keyScope: "session"`. A background worker needs no request identity or account prefix to refresh a session's query. Matching keys trigger the query's own read policy; authorized reads remain responsible for filtering rows to the viewer. A shared key can therefore trigger authorized rechecks for several accounts. Use model buckets to narrow that fan-out.

In the browser, `bind` gives each owning registry an opaque id and prefixes every client read and invalidation key of a session-scoped contract with it, so a command in one session's registry refreshes none of another session's queries, even when the registries share one runtime and its Reactivity. The server adds no prefix. Custom client coordination uses these helpers and context type:

```ts
import { clientInvalidationKeys, clientReadKeys, type KeyContext } from "@shivaedev/contract/clientKeys.ts";
```

`clientReadKeys(keys, context)` registers client dependencies; `clientInvalidationKeys(keys, context)` announces client cache changes. The context has type `KeyContext`. Never publish contextual client keys on the server.

### Compose feature bindings

Use `composeBindings(client, bindings)` when a connection contains several feature modules. The returned object keeps the client's fields and types and carries an explicit list of bound APIs. `liveBindings(connection)` reads this list; without an explicit list it finds bindings through nested object properties and arrays at any depth. It visits shared objects once and handles cycles. Explicit lists remain authoritative at each composition.

```ts
import { composeBindings } from "@shivaedev/contract/composeBindings.ts";

const modules = [notesModule, tasksModule] as const;
const connection = composeBindings(
	{ modules },
	modules.map((module) => module.api),
);
```

`notesModule` and `tasksModule` are application modules whose `api` values come from `bind` or `makeClient`. Return `connection` from React's `SessionBoundary` connection callback to mount both bindings while keeping the modules nested.

### 4. Server-pushed live queries

Database hosts from `@shivaedev/server` serve the reserved `<contract>.$changes` stream automatically. Mounted query atoms and route loaders receive their first authorized `Result` on that subscription, using the client's shared WebSocket. Registration precedes the first read so a concurrent commit cannot fall into a registration gap. Subscribing over HTTP fails with `WebSocketRequired`.

After a matching committed change, the process holding the socket reloads that subscriber's session, checks its read policy, and reruns the same handler as an ordinary read. It encodes the result with the query's success schema and compares its hash. A changed value produces `Result`; an equal value produces only `Unchanged`, acknowledging completion without replacing the visible value. Queries return their declared shape, with no transport envelope required in application data. The client sends no follow-up read.

Each subscription stores one hash per query in memory in the process holding its socket. Identical queries from different subscribers rerun independently under their own session and policy. A denied recheck sends `QueryReadDenied` before query SQL runs and clears that subscription's stored hashes. A later authorized change can therefore push the value again, even if it equals the value sent before denial. Render the denial before retained data.

The server coalesces changes per subscription: one rerun can be in flight and one can be pending. Further hints merge into the pending rerun. When the current rerun finishes, the server runs once more if dirty. Different subscriptions progress independently and in parallel; there is no global rerun limit and no client coalescing timer.

`Resync` is an internal server reconciliation signal. When more than 256 hints accumulate behind a stalled subscription, pending keys collapse to one `Resync`; further hints are absorbed until it is consumed. The server then reruns the subscriber's queries and pushes changed results. `Resync` never asks the client to issue reads.

The `paused` atom at `api[LiveConnection]` suppresses applying pushed values to the screen while continuing to observe the stream. Its `status.pending` count saturates at 256. Unpausing reopens the subscription for a current authorized result and resets that count. Bindings on one client runtime share pause state.

A live query's result stays a native initial result with `waiting: true` from mount until its subscription delivers the first result. An explicit query refresh reopens its subscription, retaining its current value with `waiting: true` until the fresh result arrives. Retryable connection failures retain the current query value during reconnection. Declared query failures and read denials still reach the query's error channel.

Visible browser `online` and `visibilitychange` events reopen active subscriptions for current values. Supply an optional native `resume` source on `makeClient` or `bind` for application or network lifecycle events; it registers a callback and returns its cleanup function. `resumeWindow` selects an embedded browser window. Disposing the registry releases the source, query subscriptions and socket resources.

`status` exposes `connection`, `failure`, `needsResync` and `pending`. A resume keeps `connection` unchanged and sets `needsResync` until the reopened subscription delivers its first update, while the query results keep their values and report nothing pending. A typed stream rejection settles as `failed`; transport failures and defects retry with the existing jittered exponential backoff. A denied subscription stays refused through matching local invalidations and resume events; it reopens when the viewer changes or the query is refreshed explicitly. A matching local invalidation still retries a subscription that settled with another failure, such as a declared `NotFound`. A query with no keys in the browser has nothing for a local invalidation to match, so such a subscription stays settled through its contract's commands, and an explicit refresh reopens it. An established subscription remains open after a policy denial so a later authorized change can restore its value. A `$changes` request is authorized as a whole; automatic query atoms subscribe separately so independent permissions remain independent.

Custom native hosts use `changesHandlerLayer`, `querySubscription(rpc, references, viewer)` and `subscribe(subscription, read)`. The authorized query runner is required and must use the same handler and read policy as an ordinary read; session-backed hosts must provide a fresh session context on each rerun. Platform's host supplies this composition. The caller owns consumption and interruption of a raw `$changes` stream, whose values are `Result`, `Unchanged` and `QueryReadDenied`. A request that names its client in the `x-shivaedev-sync` header also receives `Syncing` before each full read and `Synced` with the sync tokens the stream passed; a host passes that name as the subscription's `syncClient`, read with `syncClient(headers)` from `@shivaedev/contract/syncHeader.ts`. The command boundary of `commandGuardLayer` receives the command's sync token as its third argument, and a host without `@shivaedev/server` serves the `LiveSync` contract from `@shivaedev/contract/LiveSync.ts` with a handler that does nothing.

Server adapters import `LiveServer` from `@shivaedev/contract/live-server/service.ts` and `liveServerLayer` from `@shivaedev/contract/live-server/layer.ts`. The Layer captures the server's Reactivity service and dispatcher. `register(keys, syncClient?)` provides a scoped registration with `replaceKeys`; `resync()` reconciles its active subscriptions; `synced(token)` hands a sync token to the streams registered for the client it names. `makeLiveServer` supplies a standalone server using the same subscription engine. Server hints contain keys, never authoritative row data.

### Query policies, record keys and buckets

Contract groups carry their read-policy guard into native `RpcServer` hosts and Platform’s application host. An ordinary query evaluates its policy once per request, after identity middleware supplies `CurrentViewer` from its validated session. A false policy returns `QueryReadDenied` without running the handler. Native hosts need no policy middleware or guard Layer. Real HTTP stories exercise both hosts with allowed and denied counted policies; they prove this RPC boundary, not an application’s session or deployment policy. Platform’s application host refuses HTTP `$changes` calls with `WebSocketRequired`; subscriptions use its WebSocket protocol. Subscription delivery and pushed reruns continue to check current access.

A query declares its decoded input, result and `readPolicy` together, and declares `reads` when its handler's reads do not name its keys, as described below. `readPolicy(payload, viewer)` returns an Effect boolean. `viewer` is the session's `Option<{ id: string }>`; the browser does not send the identity. `signedIn` from `readPolicy.ts` allows any signed-in viewer and refuses a signed-out viewer. `QueryReadPolicy<Payload, E, R>` preserves typed failures and required services. Declare policy errors in the query's `rejections`; a failing access check reaches the client as its declared error, including during live reads. Only a successful `false` denies access. [Policy services](#policy-services) explains richer session requirements and where to provide implementations.

```ts
import { Schema } from "effect";
import { query } from "@shivaedev/contract/operation.ts";
import { signedIn } from "@shivaedev/contract/readPolicy.ts";

const Mine = query("mine", {
	payload: { title: Schema.String },
	success: Schema.Array(Schema.String),
	readPolicy: signedIn,
});
```

`Mine` declares no `reads`. Its handler reads `findMany({ where: { userId } })` through a `@shivaedev/sql` repository, which names the viewer's `userId` bucket, so the live query listens on that bucket. On a repository model, annotate tenant fields with `bucket()` from `@shivaedev/changes/buckets.ts` so writes announce the affected buckets. For an admin page spanning every tenant, declare `readsCollections` beside a permission read policy:

```ts
import { Effect, Schema } from "effect";
import { permission } from "@shivaedev/access/permission.ts";
import { collection } from "@shivaedev/changes/keys.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { permissionReadPolicy } from "@shivaedev/contract/permissionReadPolicy.ts";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { hasPermission } from "@shivaedev/identity/permission.ts";

const notes = collection("notes", Schema.Number);
const ManageNotes = permission("notes.manage").any;
const AllNotes = query("allNotes", {
	success: Schema.Array(Schema.String),
	readPolicy: permissionReadPolicy(ManageNotes, (required) => Effect.map(SessionUser, (user) => hasPermission(user, required))),
	reads: () => [],
	readsCollections: [notes],
});
```

The application supplies the permission checker through `permissionReadPolicy(permission, check)`; `check` receives that permission and the current viewer, and must check the viewer's grant using server services. Its failures and service requirements flow through the query like any other read policy. Supply `SessionUser` with the application's identity middleware. The policy guards both calls and subscriptions, and runs again before queries rerun. `readsCollections` requires this policy at declaration: a `signedIn` or ordinary boolean policy fails TypeScript checking, and the server reports an untyped declaration with that policy as an Effect defect during host startup. The server also refuses collection queries changed to an ordinary policy after construction as `QueryReadDenied`. A tenant-facing query instead filters its repository read by the tenant column, which names that tenant's bucket.

Collection reads reuse the bare repository table key, the same key as `notes.list`, even when the contract uses `keyScope: "session"`; record and bucket reads also use plain server keys. They add no wildcard matching or write-side work. Every committed repository insert, update, delete, upsert and bulk write already publishes that key. Generated-id inserts also publish the bare collection key alongside their generated record key, so `publishes` stories that check exact published keys must allow the bare key today. For a table named `notes`, that is `"notes"` alongside `"notes:<id>"` and any affected bucket keys. Mounting a collection subscriber adds **zero PostgreSQL NOTIFY messages per write**: it consumes the existing payloads. It adds a normal query subscription and an authorized reread when the collection changes.

For dependencies that need server data, add `serverReads(payload, viewer)`, an Effect returning extra keys. Keep `reads` for keys the browser can derive, or return `[]` there. The server checks every referenced query's policy before it runs any `serverReads`, and resolves it with the owning query handler's services. Declare its failures in the query's `rejections`, as with policy failures. A denied subscription never runs the resolver.

```ts
import { Context, Effect, Schema } from "effect";
import type { Key } from "@shivaedev/changes/keys.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { signedIn } from "@shivaedev/contract/readPolicy.ts";

class TimelineData extends Context.Service<
	TimelineData,
	{
		readonly readKeys: (workspaceId: string) => Effect.Effect<readonly Key[]>;
	}
>()("app/TimelineData") {}

const Timeline = query("timeline", {
	payload: { workspaceId: Schema.String },
	success: Schema.Array(Schema.String),
	readPolicy: signedIn,
	reads: () => [],
	serverReads: ({ workspaceId }) => Effect.flatMap(TimelineData, (data) => data.readKeys(workspaceId)),
});
```

Provide `TimelineData` on the server to load the workspace's lists and return their keys. Use an application policy that checks workspace access; derived keys are refresh dependencies and grant no read access. Each write must publish the same keys. After every rerun the server evaluates `reads` and `serverReads` again and replaces the subscription's registrations, so the keys follow the workspace while the subscription stays open. A list that joins is watched once a rerun has seen it, so the write that adds a list must publish a key the query already reads, such as a workspace bucket that `serverReads` also returns. Once a rerun has seen a list leave, that list's writes no longer rerun the query. The browser never runs `serverReads`; matching changes rerun the affected query on the server.

A handler can also name keys while it runs, with `recordRead(keys)` from `@shivaedev/changes/readRecorder.ts`, before the statement that reads by them. The live subscription registers each recorded key with the host the moment it is recorded, before that statement is sent, and matches it alongside the keys from `reads`, `serverReads` and `readsCollections`. A key recorded on a rerun is therefore watched before its read, where a `serverReads` key is watched only once the rerun has finished. A key that is already registered is not registered again, so a handler that reads the same row many times registers its key once. Nothing the query's read policy records counts, whether through repository reads or its own `recordRead` calls: permission changes refresh nothing live, so a write to a row only the policy reads does not rerun the query.

A query may leave out `reads`. Declared keys are used exactly as declared, even when `reads` returns `[]`. A query that declares none, with no `reads`, `serverReads` or `readsCollections`, listens on what its repository reads from `@shivaedev/sql` pin: a row, a bucket, or the whole table for an unfiltered read. The [sql guide](https://github.com/ShivaeDev/platform/blob/main/packages/sql/README.md#live-reads-listen-on-what-they-filter-by) lists which key each filter pins. Keys a handler records itself with `recordRead` count either way. A raw SQL read written with `readSql` from `@shivaedev/sql/readSql.ts` listens on the bucket and row keys interpolated as its parameters, as the [sql guide](https://github.com/ShivaeDev/platform/blob/main/packages/sql/README.md#a-raw-read-names-its-key-at-its-parameter) shows. A read through the native `sql` tag records no key, so a query whose handler reads only that way and leaves out `reads` registers nothing and never reruns; such a query keeps its `reads`. When a query that declares no keys finishes a run with no key recorded, the host logs a warning that names the query and says to mark its raw reads or declare `reads`; the subscription carries on, because a handler may read nothing for some payloads. Declare `reads: () => []` for a query that reads nothing, which logs no warning. The browser never sees the keys a host records, so there a query without `reads` has no keys, like one with `reads: () => []`; [read and change](#3-every-day-read-and-change) says how a `live: false` binding refreshes such a query, and [server-pushed live queries](#4-server-pushed-live-queries) when its failed subscription reopens.

Live query handlers read at READ COMMITTED, PostgreSQL's default, which statements and plain Effect SQL transactions keep: each statement takes its snapshot after the key recorded before it is registered, so a commit to that key is either read by the statement or heard afterwards. A handler that opens a REPEATABLE READ or SERIALIZABLE transaction keeps one snapshot from its first statement, so it declares its keys in `reads` or `serverReads` instead. The [changes guide](https://github.com/ShivaeDev/platform/blob/main/packages/changes/README.md#record-what-a-live-read-listens-on) shows the call.

Return `false` when denial may be disclosed; the caller receives `QueryReadDenied`. For a private item whose existence the viewer must not learn, fail with a declared `NotFound` for both an absent item and an item owned by someone else:

```ts
import { Context, Effect, Option, Schema } from "effect";
import { query } from "@shivaedev/contract/operation.ts";
import { NotFound } from "@shivaedev/errors/taxonomy.ts";

class NoteOwner extends Context.Service<NoteOwner, (id: number) => Effect.Effect<Option.Option<string>>>()("app/NoteOwner") {}
const PrivateNote = query("privateNote", {
	payload: { id: Schema.Number },
	readPolicy: ({ id }, viewer) =>
		Effect.gen(function* () {
			if (Option.isNone(viewer)) {
				return false;
			}
			const owner = yield* (yield* NoteOwner)(id);
			if (Option.isNone(owner) || owner.value !== viewer.value.id) {
				return yield* new NotFound({ message: "Note not found" });
			}
			return true;
		}),
	reads: () => [],
	rejections: { NotFound },
	success: Schema.String,
});
```

The server provides `NoteOwner`; the shared declaration holds only its browser-safe service tag. The same typed rejection reaches ordinary reads and live subscriptions.

A record key, `notes.item(id)`, names one record. A bucket, `notes.bucket.userId(id)`, names every row with that field value. Declare bucket fields on the collection model with their schemas. A list may add title, state or other filters to its input and handler, but those filters never narrow its bucket. It reruns whenever any row in that bucket changes, including a row excluded by the filter. Writers explicitly announce the record and affected buckets with the same constructors from `@shivaedev/changes/keys.ts`.

The same query policy guards running the query and subscribing to it. A subscription is meant to carry one query. It names query references, never arbitrary record or bucket keys. If a subscription mixes queries the viewer may and may not read, the entire subscription is refused with `QueryReadDenied`; it delivers no partial results. Every query requires `readPolicy` at declaration, including queries used only through one-off `run` calls. TypeScript rejects a policy-less declaration before handlers or a live server can be built. Platform’s application host validates the complete RPC group while building its Layer, before listening; untyped declarations missing policies fail with `MissingReadPolicies`, whose `queries` and `message` name every affected RPC. Native hosts enforce read policies automatically at request time. `MissingReadPolicy` remains a request-time refusal for untyped declarations served through native servers that bypass that boot check, on plain calls and subscriptions alike. Reads outside a declared query acquire no automatic subscription.

Session middleware supplies `CurrentViewer` after validating the session. Each rerun uses a freshly loaded session and the same authorized handler as an ordinary read. A removed session ends the subscription with `Unauthorized`; a current session denied by the read policy receives `QueryReadDenied`, with no query SQL and its stored hash cleared. The established subscription stays open for later authorized changes. Raw consumers handle `Result`, `Unchanged` and `QueryReadDenied`.

### Policy services

Use the policy's `viewer` argument for the viewer ID. Read richer session context from Effect requirements. For example, a policy service can require `SessionUserWithProviderAccounts` from `@shivaedev/identity/identity.ts` and yield its `providerAccounts` Effect. Apply `AuthenticatedUserWithProviderAccounts` middleware to the contract and supply `authenticatedUserWithProviderAccountsLayer()` from `@shivaedev/identity/server/session.ts` alongside its handlers, with the shared `SessionPolicy` Layer provided once by the application host. The middleware provides this request-local context for both RPC calls and live reruns, including each policy recheck before a result is delivered. Session-backed hosts reload that context before each rerun, and use the same snapshot for its policy and query rerun.

Keep the policy service tag and query declaration browser-safe; put its implementation on the server. Its method retains the session service in its requirements so the session is read when the policy runs:

```ts
import { Context, Effect, Option, Schema } from "effect";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";
import type { Viewer } from "@shivaedev/contract/readPolicy.ts";
import { AuthUnavailable, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { SessionUserWithProviderAccounts } from "@shivaedev/identity/identity.ts";
import { AuthenticatedUserWithProviderAccounts } from "@shivaedev/identity/middleware.ts";

class ReadAccess extends Context.Service<
	ReadAccess,
	{
		readonly allows: (
			accountId: string,
			viewer: Option.Option<Viewer>,
		) => Effect.Effect<boolean, AuthUnavailable | Unauthorized, SessionUserWithProviderAccounts>;
	}
>()("app/ReadAccess") {}

const Get = query("get", {
	payload: { accountId: Schema.String },
	readPolicy: ({ accountId }, viewer) => Effect.flatMap(ReadAccess, (access) => access.allows(accountId, viewer)),
	reads: () => [],
	rejections: { AuthUnavailable, Unauthorized },
	success: Schema.String,
});
const Documents = contract("documents", { queries: [Get] }).middleware(AuthenticatedUserWithProviderAccounts);
```

Provide the implementation from the query's handlers layer with native `Layer.provide`:

```ts
import { Effect, Layer, Option } from "effect";

const ReadAccessLive = Layer.succeed(ReadAccess, {
	allows: (accountId, viewer) =>
		Effect.gen(function* () {
			const user = yield* SessionUserWithProviderAccounts;
			const accounts = yield* user.providerAccounts;
			return (
				Option.isSome(viewer)
				&& viewer.value.id === user.id
				&& accounts.some((account) => account.providerId === "github" && account.accountId === accountId)
			);
		}),
});
const DocumentHandlers = Documents.application
	.toLayer({
		"documents.get": ({ accountId }) => Effect.succeed(`Document for ${accountId}`),
	})
	.pipe(Layer.provide(ReadAccessLive));
```

The generated subscription uses the owning query handler's captured services too, so this handler-only provision serves subscriptions as well as RPC calls. Request-local services take precedence over captured services; a session value installed while building handlers cannot replace the current viewer's session. The policy runs again for live reruns; its allow or deny result is not cached.

### In-memory clients in story kits

`layerMemoryProtocol(group)` from `@shivaedev/test-kits/contract/testing.ts` connects the native RPC client and server in the same process. Provide the group's handlers and middleware with `Layer.provide`, then pass the protocol to the application's client factory:

```ts
import { Layer } from "effect";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { layerMemoryProtocol } from "@shivaedev/test-kits/contract/testing.ts";

const client = makeClient(Notes, {
	protocol: layerMemoryProtocol(Notes).pipe(Layer.provide(handlers)),
	url: "memory://notes",
});
```

The URL identifies the client configuration; the in-memory protocol opens no socket. The client's direct calls and bound query atoms use the real handlers, schema decoding and middleware. Live subscriptions use the supplied handlers and change source, and mounted queries refresh from their updates. Closing a subscription interrupts its server stream. The protocol does not add handlers or publish changes: provide the same live handlers and change source that the application serves over WebSocket. It refuses a group the application host would refuse to start, such as one whose RPC uses a field name both as sensitive and as public, with the host's error; the [test-kits README](https://github.com/ShivaeDev/platform/tree/main/packages/test-kits#contract-subscriptions) describes the check.

### Settled queries in stories

Use `settledQueries` from `@shivaedev/test-kits/contract/settledQueries.ts` in a story kit's scoped setup to observe a bound query:

```ts
import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { settledQueries } from "@shivaedev/test-kits/contract/settledQueries.ts";

const results = yield* settledQueries(client.api.list.query()).pipe(Effect.provideService(AtomRegistry.AtomRegistry, registry));
const first = yield* results.next;
const current = yield* results.latest;
```

`next` consumes the current settled result, then each completed refresh, including equal values and failures, as native `AsyncResult` values. Pending reads are not queued. `latest` reads the current `AsyncResult`, which may still be loading. Closing the Effect scope releases the watcher; independent scopes can observe the same query.

### Live results in stories

Observe raw result streams with `watchHints` from `@shivaedev/test-kits/contract/testing.ts`, or wait on a mounted query's completion counter through `querySignals`. Assert the delivered value or rendered screen. An equal rerun increments completion through `Unchanged`, so waiting on value identity alone misses it.

### API by module

Import the module that defines the name; the package has no root entry.

| Module                     | Functions and schemas                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `operation.ts`             | `query(name, { payload?, *run, readPolicy?, reads?, serverReads?, readsCollections? })` and `command(name, { payload?, *run, invalidates?(payload, viewer?) })` with an Effect-returning `run`; declared without run: `query(name, { payload?, success?, rejections?, readPolicy, reads?, serverReads? })`, `command(name, { payload?, success?, rejections?, invalidates(payload, result, viewer?) })` and `stream(name, { payload?, success, rejections?, reads })`.                                    |
| `contract.ts`              | `contract(name, { queries?, commands?, streams?, keyScope? })`, returning a native RPC group with `declaration: { name, queries, commands, streams, keyScope }`.                                                                                                                                                                                                                                                                                                                                          |
| `defineModule.ts`          | `defineModule({ name, operations, wire, middleware?, subject?, keyScope? })`, returning the module's contract, whose type carries the services each operation yields.                                                                                                                                                                                                                                                                                                                                     |
| `moduleHandlers.ts`        | `moduleHandlers(module)`, the module's handler Layer, requiring exactly the services its operations yield beyond its middleware and subject.                                                                                                                                                                                                                                                                                                                                                              |
| `clientContract.ts`        | `clientContract({ name, wire, payloads?, queries?, commands?, middleware?, subject?, keyScope? })`, the browser's contract of a module that generated files build.                                                                                                                                                                                                                                                                                                                                        |
| `clientMatchesModule.ts`   | `ClientMatchesModule<Client, Module>`, `true` when the browser's contract and the server module have the same RPCs, else `ClientDiffersFromModule`.                                                                                                                                                                                                                                                                                                                                                       |
| `rejection.ts`             | `fieldRejection(struct, fields?)`; lower-level `rejectionSet(specs)`, which constructs the rejection classes, union schema and failure helpers used by operations.                                                                                                                                                                                                                                                                                                                                        |
| `bind.ts`                  | `bind(contract, atomRpcService, { registry?, live?, resume?, resumeWindow? }?)`, requiring the registry for session-scoped contracts and exposing `{ query, run, runtime }` for queries, `{ run, payload, runtime }` for commands and `{ run, runtime }` with native Streams for streams; `makeClient(contract, { url, protocol?, headers?, webSocketConstructor?, group?, registry?, live?, resume?, resumeWindow? })`, which builds the shared WebSocket client and binds it, with `sync` beside `api`. |
| `clientKeys.ts`            | `KeyContext`, `clientReadKeys`, `clientInvalidationKeys`: registry-local cache keys for custom clients.                                                                                                                                                                                                                                                                                                                                                                                                   |
| `live.ts`                  | `LiveHint` schema; `live(runtime, { stream, keyContext?, resume?, retryDelay?, retryKeys? })`, exposing `connection`, `paused` and `status`; `isLiveConnection(atom)` tells whether an atom is such a `connection`, which waits for as long as its subscription runs.                                                                                                                                                                                                                                     |
| `querySubscription.ts`     | `querySubscription(rpc, references, viewer)` checks each referenced query, resolves its payload and server-derived keys, and captures its scopes and ongoing authorization.                                                                                                                                                                                                                                                                                                                               |
| `live-server/service.ts`   | `LiveServer`, the shared live server service.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `live-server/layer.ts`     | `liveServerLayer`, providing `LiveServer` and its dispatcher dependency, requiring `Reactivity`.                                                                                                                                                                                                                                                                                                                                                                                                          |
| `live-server/subscribe.ts` | `subscribe(subscription, read?)`, an Effect requiring `LiveServer` that returns an authorized subscription Stream with its policy and query-runner requirements.                                                                                                                                                                                                                                                                                                                                          |
| `makeLiveServer.ts`        | `makeLiveServer`, an Effect requiring `Reactivity` that creates scoped server hint streams, a `resync` Effect and `synced(token)`.                                                                                                                                                                                                                                                                                                                                                                        |
| `readPolicy.ts`            | `QueryReadPolicy`, `Viewer`, `signedIn`, `CurrentViewer`; `authorizeReads(effect, request, viewer)` for direct handler reruns outside RPC middleware.                                                                                                                                                                                                                                                                                                                                                     |
| `ReadPolicyGuard.ts`       | `ReadPolicyGuard`, the defaulted middleware reference attached to contract queries; `readPolicyGuardLayer({ websocket? })`, an optional override that refuses HTTP `$changes` calls by default.                                                                                                                                                                                                                                                                                                           |
| `validateReadPolicies.ts`  | `validateReadPolicies(group)`, an Effect that fails with `MissingReadPolicies` when any served or subscribable query omits its policy.                                                                                                                                                                                                                                                                                                                                                                    |
| `readPolicyErrors.ts`      | `MissingReadPolicies` (boot), `MissingReadPolicy` (native-server request fallback) and `QueryReadDenied`.                                                                                                                                                                                                                                                                                                                                                                                                 |
| `CommandGuard.ts`          | `guardCommands(group)` places command publication inside viewer-providing middleware; `commandGuardLayer(boundary)` evaluates declared invalidations for that viewer and delegates publication to the host boundary.                                                                                                                                                                                                                                                                                      |
| `commandResult.ts`         | `commandResult({ result, invalidates })` contributes server-only keys from a guarded command's `run` or handler and returns only its success value.                                                                                                                                                                                                                                                                                                                                                       |
| `serverMetadata.ts`        | `QueryDefinition.definition`, `CommandInvalidation.invalidates`, `ChangesQueries.queries`, `ChangesQueries.resolve(references)` and `changesRpc(name, queries)` for server adapters.                                                                                                                                                                                                                                                                                                                      |
| `queryKeys.ts`             | `queryKeys(queries, references, viewer?)` authorizes references and resolves payload and server-derived keys using the provided services.                                                                                                                                                                                                                                                                                                                                                                 |
| `QueryServerReads.ts`      | `QueryServerReads<Payload, E, R>`, the server-only resolver type.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `resume.ts`                | `resumeSignal({ window?, native? })`, returning a native numeric signal atom.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `querySignals.ts`          | `querySignals(query)` exposes completion counts and subscription status as a native atom.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `retainQuery.ts`           | `queryRuntime(query)` returns the atom runtime a bound query runs on, so a reader can schedule work on the same Effect `Clock`.                                                                                                                                                                                                                                                                                                                                                                           |
| `clientActivity.ts`        | `clientActivity(client)` exposes a native activity Stream with a `current` Effect; `isClientSettled(state)` checks commands, commands not yet reflected and first query results; `isClientIdle(state)` checks all finite work; `activityScreenSignal(activity, settled?)` projects pending work for screen waits.                                                                                                                                                                                         |
| `commandSignal.ts`         | `untilReflected(command)` completes a command's Effect when it is reflected; `CommandSignal` receives each `CommandState`.                                                                                                                                                                                                                                                                                                                                                                                |
| `LiveSync.ts`              | `LiveSync`, the host's contract of the `platform.liveSync.request` command that carries a sync token and writes nothing. Browser code takes the same command from `liveSyncRpc.ts`.                                                                                                                                                                                                                                                                                                                       |
| `liveSyncRpc.ts`           | `liveSyncRpc`, the RPC group a client declares for that command without importing its operation file, and `LIVE_SYNC`, its tag.                                                                                                                                                                                                                                                                                                                                                                           |
| `syncHeader.ts`            | `syncClient(headers)` and `syncToken(headers)` read the client name and the sync token a request carries.                                                                                                                                                                                                                                                                                                                                                                                                 |
| `operationKind.ts`         | `operationKind(rpc)`: `"read"` for a query, a changes stream or a stream, `"write"` for a command or an RPC no contract marked.                                                                                                                                                                                                                                                                                                                                                                           |
| `subjectHeader.ts`         | `subjectHeader(headers)` reads the account a call names; `withSubject(headers, subject)` and `subjectSerializationKey(key, headers)` are what bound operations use to send it and to keep serialized results apart.                                                                                                                                                                                                                                                                                       |
| `screenSync.ts`            | `screenSync(client, registry)` runs a client's `sync` through a registry, for a screen driver's `sync` option.                                                                                                                                                                                                                                                                                                                                                                                            |

A bound query’s optional second argument accepts `headers`, `subject` and `serializationKey`. Successful results remain in their owning registry for five minutes after the last reader leaves, up to 100 idle queries, evicting the least recently left first. Reopening a query immediately returns the retained success with native `waiting: true` while a new subscription or read supplies fresh data. Execution stops between readers. Configure the registry’s `queryRetention` atom from `@shivaedev/contract/queryRetention.ts` with `{ timeToLive: "1 minute", capacity: 50 }`, or set React’s `SessionBoundary` prop of the same name. Zero for either disables idle retention. Expiry runs on the query runtime’s Effect Clock. Registry disposal clears all retained results; applications outside `SessionBoundary` own that disposal when their session changes. A native resume source receives a callback and returns a cleanup function.

### Install, setup and limits

```sh
pnpm add @shivaedev/contract effect
```

`effect` is a peer, and the package needs Node.js 24 or newer. Choose the native server host separately; this package supplies no server process or HTTP transport implementation.

- Put schema declarations where server and browser can share them. Put service, authorization and transaction implementations on the server. React rendering and editable forms belong to `react` and `form`.
- Run command Effects with the Reactivity instance that owns the queries to refresh, as in the registry example.
- Choose a common read key for every query in a full reconciliation scope. A list key does not implicitly cover item queries.
- Supply browser or native resume sources explicitly.
- Live results carry the query’s current authorized value; server change hints carry keys and no durable history. Applications own dependency discovery, authenticated subscriptions, delivery across processes, SSR and deployment behavior.

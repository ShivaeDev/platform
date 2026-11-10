# @shivaedev/contract

Declare a feature's queries, commands, streams, expected failures and refresh dependencies once. The declarations become native Effect RPC definitions, and a client binding connects their dependency keys to native AtomRpc queries.

## Why you want this

A feature often repeats its inputs, results and errors on both sides of an RPC boundary, then separately wires which views a write should refresh. Those copies are easy to make disagree. Put the boundary and its dependencies together:

```ts
import { Effect, Schema } from "effect";
import { contract } from "@shivaedev/contract/contract.ts";
import { collection } from "@shivaedev/changes/keys.ts";
import { command, query } from "@shivaedev/contract/operation.ts";

const notes = collection("notes", Schema.Number);
const List = query("list", { readPolicy: () => Effect.succeed(true), reads: () => [notes.list], success: Schema.Array(Schema.String) });
const Rename = command("rename", {
	payload: { id: Schema.Number, title: Schema.String },
	invalidates: ({ id }) => [notes.item(id)],
});
const Notes = contract("notes", { queries: [List], commands: [Rename] });
```

`Notes` is a native RPC group with `notes.list` and `notes.rename` handlers. When its bound rename call succeeds, the declared item change refreshes the list. An item query for another note keeps its result. Handlers, middleware and transport use Effect's own APIs.

## Using it

### How to think about it

An **operation** describes a boundary, not its implementation: its name, payload schema, success schema and expected failures. A **query** also declares the keys it reads; a **command** declares the keys its successful result changes. A **stream** declares an element schema in `success`, typed rejections and the keys it reads. A **rejection** is an expected typed failure, such as a missing note or an invalid title. Middleware failures and RPC client failures remain separate parts of the native client's error type.

A **contract** groups operations into a native `RpcGroup`. Its RPC tags are the contract name and operation name joined by a dot. A **binding** connects that declaration to an existing `AtomRpc.Service`: queries get native query atoms and call Effects, while commands get call Effects that invalidate after success. Streams expose a native `Stream` through `run`; the caller owns consumption and interruption.

A **collection key** names a dependency. Its item key identifies one item; its list key identifies a list in that collection. Keys do not hold data. Native query atoms hold results, and native Reactivity asks matching queries to run again.

Live subscriptions use those same keys to rerun each subscriber’s authorized query on the server and push its changed result.

### 1. Once per feature: schemas and operations

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

Save this module as `notes.ts`. The payload can be struct fields, as in `Get`, or a schema, as in `Create`. An omitted payload or success is `Schema.Void`; no declared rejections gives `Schema.Never`. The server resolves `reads` with the decoded payload and session viewer. For local command dependencies, the browser also evaluates it with `Option.none()`; return no viewer keys for that case. Authorized subscription scopes always come from the server. `invalidates` receives the decoded payload, successful result and optional session viewer, so a create call can invalidate the ID the server assigned.

The collection's ID schema gives `item` its ID type. Here, `notes.item` takes a number. Query and command callbacks retain their payload and result types, including when the operations are declared inline inside `contract`.

Operation names must differ within a contract, including across queries, commands and streams. Literal duplicate declarations fail compilation. If the compiler cannot see the names in an array, the server reports duplicate names as an Effect defect while validating the contract during host startup.

The native RPC mapping types `OperationRpc` and `Tag` are exported from `@shivaedev/contract/operationRpc.ts`.

### An operation written as its payload and run

An operation can also be written as its business logic: a `payload` schema and a generator `*run`, with no `Effect.gen` wrapper. Its success, rejections, services and the read policy's failures are inferred from `run`:

```ts
import { Effect, Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { fieldRejection } from "@shivaedev/contract/rejection.ts";
import { NotesRepository, SessionUser } from "./services.ts";

export const NoteFields = Schema.Struct({ title: Schema.Trim.check(Schema.isNonEmpty({ message: "Enter a title" })) });
export class TitleTaken extends Schema.TaggedError<TitleTaken>()("TitleTaken", fieldRejection(NoteFields)) {}
const notes = collection("notes", Schema.Number);

export const Create = command("create", {
	invalidates: () => [notes.list],
	payload: NoteFields,
	*run({ title }) {
		const repository = yield* NotesRepository;
		const { id: userId } = yield* SessionUser;
		if (title === "reserved") {
			return yield* new TitleTaken({ field: "title", message: "That title is reserved" });
		}
		return yield* repository.insert(title, userId).pipe(Effect.map(({ id }) => ({ id, title })));
	},
});

export const List = query("list", {
	reads: () => [notes.list],
	*run() {
		const repository = yield* NotesRepository;
		const { id: userId } = yield* SessionUser;
		return yield* repository.findMany(userId);
	},
});
```

`Create.run` is an Effect-returning function, so another operation composes it with `yield* Create.run({ title })`, and `Create`'s services and failures join that operation's types. A query without `readPolicy` gets `signedIn`, at run time and in its type; it still declares `reads`, and may declare `serverReads` and `readsCollections` (which need a `permissionReadPolicy`). A command without `invalidates` announces no keys of its own. A payload-free operation omits `payload` and gets `Schema.Void`.

`success` and `rejections` are optional. A declared one must equal what `run` infers, checked on the declaration object, and each mismatch is a compile error that names the operation and the problem: `RunReturnsAny` when `run` returns `any`, such as the result of `JSON.parse`, which would otherwise pass every check (decode the value with a schema, or type it); `SuccessDiffersFromRun` when the declared success's type and `run`'s return type are not mutually assignable; `SuccessClassNotReturned` when the success is a `Schema.Class`, or holds one in an array, struct field, tuple, record, union or `Option`, and `run` returns something other than that class in that position, such as an object literal of its fields, which fails to encode; `ArrayMutabilityDiffers` when they differ only in array mutability, because `Schema.Array` decodes a readonly array (return one, or declare `Schema.mutable`); `RunFailsOutsideRejections` when `run` or the read policy can fail with a tag that `rejections` misses; `RejectionsRunNeverRaises` for a listed tag nothing raises; `RejectionClassDiffers` when a listed class and the class `run` raises under the same tag differ in shape, such as a local `NotFound` with other fields than the shared one; `RejectionAutomatic` for a listed `InternalServerError` or `ServiceUnavailable`. Rejections are exported classes keyed by their `_tag`. A failure that states `isRetryable` (such as `SqlError`), `SchemaError` and `QueryReadDenied` are never rejections. While the declaration forms above are still accepted, such an error starts with "No overload matches this call" and its last line names the problem.

TypeScript compares classes by shape, so two cases still compile: a rejection class whose twin of the same shape is what `run` raises, and a helper typed to return a readonly interface of the same shape where the success is a `Schema.Class`. Neither is silent at run time: the twin is not the declared class, so the boundary answers `InternalServerError` and reports it, and the plain object fails to encode. The generator in [`@shivaedev/build`](https://github.com/ShivaeDev/platform/tree/main/packages/build), which derives `success` and `rejections` from `run`, resolves both by declaration.

Every operation written this way carries `InternalServerError` and `ServiceUnavailable` in its type and its rejection set, and cannot list them. Nothing adds `Conflict`: an operation that answers a constraint violation as a domain failure maps it by constraint name in `run`, and inference carries the result. Because object keys are sorted, `invalidates` is checked before `run`, so its result parameter is typed only when `success` is declared.

Two limits meet you while writing these operations. On its own, an omitted success is `Schema.Void` and omitted rejections leave only the automatic two in the operation's RPC schemas; a module's wire supplies both (below), and an operation served through `contract()` declares them. Biome's `useYield` refuses a `*run` that yields nothing, so a `run` that needs no service still yields an Effect.

A field failure is an exported tagged class built from the payload's fields with `fieldRejection`, as `TitleTaken` above. `run` raises it with `yield* new TitleTaken({ field, message })`, and `@shivaedev/form`'s `rejecting` places its message on that field.

### A module defined from its operations

A module lists its operations once, with the services they may use, and serves them without hand-written handlers:

```ts
import { Effect, Option, Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";
import { NotFound, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { CurrentViewer } from "@shivaedev/contract/readPolicy.ts";
import { fieldRejection } from "@shivaedev/contract/rejection.ts";
import { Caller, NotesStore, type StoredNote } from "./services.ts";

const notes = collection("notes", Schema.Number);
export const NoteFields = Schema.Struct({ title: Schema.String });
export const Note = Schema.Struct({ id: Schema.Number, title: Schema.String });
export class TitleTaken extends Schema.TaggedError<TitleTaken>()("TitleTaken", fieldRejection(NoteFields)) {}

const signedInUser = Effect.flatMap(CurrentViewer, (viewer) =>
	Option.match(viewer, {
		onNone: () => Effect.fail(new Unauthorized({ message: "Sign in first" })),
		onSome: ({ id }) => Effect.succeed(id),
	}),
);

function toNotes(stored: readonly StoredNote[]): readonly (typeof Note.Type)[] {
	return stored.map(({ id, title }) => ({ id, title }));
}

export const Create = command("create", {
	payload: NoteFields,
	rejections: { TitleTaken, Unauthorized },
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
	success: Note,
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
	rejections: { NotFound },
	*run({ id }) {
		const note = yield* (yield* NotesStore).find(id);
		if (Option.isNone(note)) {
			return yield* new NotFound({ message: "Note not found" });
		}
		return { id: note.value.id, title: note.value.title };
	},
	success: Note,
});

export const List = query("list", {
	reads: () => [notes.list],
	rejections: { Unauthorized },
	*run() {
		const store = yield* NotesStore;
		return toNotes(yield* store.owned(yield* signedInUser));
	},
	success: Schema.Array(Note),
});

export const Notes = defineModule({
	middleware: Caller,
	name: "notes",
	operations: [List, Get, Create],
	requires: [NotesStore],
});
```

Here `NotesStore` is an ordinary service, `StoredNote` the row it returns, and `Caller` an RPC middleware that sets the viewer. `defineModule` takes the operations written as payload and run, the services they may use in `requires`, optionally `middleware`, `subject` and `keyScope` as `contract` does, and its `wire` (below). It returns the module's contract, so `bind`, `makeClient` and a host accept it as they accept any contract. Each of its RPCs carries the `DefinedModule` annotation from the same file with the module's name, so a host can tell a module's queries from a contract's. The compiler checks `requires`, and the module does not keep the list at run time. Its generics check the definition on the `name` line, so the first line of the compiler's message names the operation and its problem: `OperationNeedsUndeclaredServices` when an operation's `run` or read policy uses a service that neither `requires` nor the middleware or subject provides, `OperationFailsOutsideItsRejections` when it can fail with something outside its rejections other than an infrastructure failure, and `OperationNameRepeated` when two operations share a name:

```
src/test-support/fixtures/invalid/moduleUndeclaredService.ts(24,2): error TS2322: Type '"imports"' is not assignable to type '"imports" & NoInfer<OperationNeedsUndeclaredServices<"importTitle", NoteSource>>'.
```

`moduleHandlers(Notes)` builds the module's handler Layer from its operations, and the Layer requires exactly the services in `requires`:

```ts
import { Layer } from "effect";
import { moduleHandlers } from "@shivaedev/contract/moduleHandlers.ts";
import { Notes } from "./notes.ts";
import { NotesStoreLive } from "./store.ts";

export const NotesHandlers = moduleHandlers(Notes).pipe(Layer.provide(NotesStoreLive));
```

Each operation runs in a span named after the module and the operation, such as `Notes.create`. A query's read policy is checked inside its handler before `run`, with the module's services, so a policy reads a repository directly, as `Get` does above; a live subscription to the query checks the same policy. Failures pass the RPC boundary from `@shivaedev/errors`: a declared rejection reaches the client as itself, an undeclared failure that states `isRetryable` answers `ServiceUnavailable`, and anything else answers `InternalServerError`, for the policy of a live subscription too. A command without `invalidates` publishes only the keys its writes announce.

#### The wire and the browser's contract

Types are erased, so the success schema and rejection classes the server encodes with and the browser decodes with must exist as values. [`@shivaedev/build`](https://github.com/ShivaeDev/platform/tree/main/packages/build) writes them from each module's `run` types into one file per module under `src/generated/`, which stays out of Git. It is not published yet and no `generate` script exists, so an application outside this repository writes the wire by hand, or its operations declare `success` and `rejections` and the module passes no wire. The module file passes its wire, and every operation that has a wire entry is served with that entry's success and rejections, plus `InternalServerError` and `ServiceUnavailable`, even when the operation declares its own; an operation without an entry is served with what it declares:

```ts
import { notesWire } from "#generated/modules/notes/notes.ts";

export const Notes = defineModule({
	middleware: Caller,
	name: "notes",
	operations: [List, Get, Create],
	requires: [NotesStore],
	wire: notesWire,
});
```

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

`clientContract` requires a wire entry for every query and command it declares. The browser imports `Notes` from that file and binds it like any contract; it carries no `run`, read policy or service, and its import graph reaches no server code. A command's `invalidates` and a query's `reads` work in the browser exactly as on a contract written by hand. Over RPC's JSON serialization, a `Schema.Date` field arrives as a `Date` equal to the one `run` returned, and a rejection the wire lists arrives as its class. Neither the browser's contract nor an operation without a read policy can be served: `contract()` requires one on every query, and a host refuses a query without one at start-up.

The compiler compares the wire with `run` on every type check, exactly as it compares a declared `success` and `rejections`, and a stale file is an error on the module's `name` line that names the operation, one problem per operation: `WireSuccessStale` when the wire's success differs from what `run` returns, `WireRejectionsStale` when its rejection tags or classes differ from what `run` and a query's read policy raise, other than infrastructure failures, and `OperationMissingFromWire` when an operation declares no success, returns something, and has no wire entry. The browser's assertion fails with `ClientDiffersFromModule`, naming the operations whose RPCs differ. `ClientMatchesModule` compares the operations' payloads, successes and rejections; a stale copy of a query's `reads`, a command's `invalidates` or the key scope in the generated file still compiles; the generator keeps those current, because a change to them makes `shivaedev-build generate --check` report the file stale. A stale wire and a stale browser contract read:

```
src/test-support/fixtures/invalid/moduleStaleRejection.ts(9,2): error TS2322: Type '"staleRejection"' is not assignable to type '"staleRejection" & NoInfer<WireRejectionsStale<"create", "the generated file is stale; run pnpm generate", "TitleTaken" | "Unauthorized", "Unauthorized">>'.
src/test-support/fixtures/invalid/staleNotes.ts(17,14): error TS2322: Type 'boolean' is not assignable to type 'ClientDiffersFromModule<"create", "the generated file is stale; run pnpm generate">'.
```

### Whose account a request acts on

Set `subject` on a contract to a browser-safe declaration from `@shivaedev/identity/subject.ts`: `selfSubject` selects the session account; `accountSubject({ permission, refusal, deny })` permits another account only with the permission's `any` grant. The declaration applies to the application RPCs and their changes stream. Native middleware carries its typed failures and supplies the branded `Subject` service to handlers and the application services they call. Business payloads need no owner id.

```ts
import { contract } from "@shivaedev/contract/contract.ts";
import { command } from "@shivaedev/contract/operation.ts";
import { selfSubject } from "@shivaedev/identity/subject.ts";

const Save = command("save", { invalidates: () => [] });
export const Account = contract("account", { commands: [Save], subject: selfSubject });
```

Contracts with declared subjects can be exported from published packages with TypeScript declaration output. The client calls `account.save` without an account id. The session host installs the resolver; handlers read `Subject` from the request environment. See [identity's subject guide](https://github.com/ShivaeDev/platform/tree/main/packages/identity#declared-request-subjects) for delegated selection and refusal declarations.

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

`invalid` is the generated class instance. `refused` and `missing` are failed Effects, with the corresponding rejection in their error channel. Each operation also exposes `payload`, `success` and `error`, so another boundary can use its schemas directly. A handler returning an undeclared rejection fails compilation.

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

`one` and `list` are native query atoms. `readOnce` and `rename` are Effects for individual calls. A query's Effect requires `NotesClient`; a command's Effect also requires native `Reactivity`. Commands expose `run`, and have no `query` member.

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

The browser invalidates a command's keys after RPC success. That local invalidation refreshes queries bound with `live: false`. A live bound query, the default on database hosts, gets its refresh from the server push instead: the server reruns it when the command's keys are published there, and the local invalidation only retries its subscription after that subscription failed with something other than `QueryReadDenied` ([Server-pushed live queries](#4-server-pushed-live-queries)). Database hosts from `@shivaedev/server` publish declared command invalidations on the server after the handler succeeds, excluding keys already announced by repository commits, using `transact` from [`sql`](https://github.com/ShivaeDev/platform/tree/main/packages/sql); commit-bound changes belong to [`changes`](https://github.com/ShivaeDev/platform/tree/main/packages/changes).

#### Server-only command keys

When the affected readers depend on database relationships, return the success through `commandResult` in the server handler. Its `invalidates` keys join the declaration's keys at the command guard. Only `result` becomes the RPC success; the extra keys and the audience used to find them stay on the server.

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

### Host build announcements

`HostVersion` from `@shivaedev/contract/HostVersion.ts` declares the native `platform.hostVersion.watch` string stream shared by the application host and React's deploy controller. The host announces its configured build ID on subscription, including after a host replacement reconnects. It uses the same shared WebSocket connection as other `makeClient` bindings with matching transport options. Applications normally use the controller from `@shivaedev/react/client/deployUpdate.ts` rather than consuming this stream directly.

### Client activity

`clientActivity(client)` from `@shivaedev/contract/clientActivity.ts` returns a native Effect `Stream` with a `current` Effect for a client made by `makeClient`. Its state includes `connectionStatus`, a `"live" | "reconnecting" | "waiting-for-connection"` value aggregated across mounted queries from all bindings of the same client service, with live subscription changes debounced for 300 ms on the client runtime’s Clock and held commands reported immediately. Refused subscriptions do not count as reconnecting. The stream also exposes its native `connectionStatus` atom for React readers.

For screen stories, pass `activityScreenSignal(clientActivity(client))` to a test-story screen driver's `activity` option. By default, `settle()` waits for commands in flight and the first result of each mounted query, then flushes the renderer. Contract identifies commands from its own RPC annotations; kits need no query-name exceptions. The activity state's `commands` count includes commands held for a connection, and `initialQueries` counts mounted queries until their first success or failure. Unmounting releases that query's pending activity. `isClientSettled(state)` checks these two counts. An open live query that has delivered its first result, including one awaiting a later refresh, does not keep a screen story pending.

`activityScreenSignal(activity)` projects the stream and its `current` Effect into `{ pending, connectionStatus }`. The returned shape is structural and carries no test-story dependency. Stories that need a later live change wait for it with the screen driver's `withLiveAnswer` and `liveAnswers` below, then settle the screen. `isClientIdle(state)` retains the full finite-work check: `rpcCalls` for finite calls, `refreshingAtoms` for mounted query atoms awaiting values must all be zero. Long-lived subscription streams and server reruns themselves do not count as finite calls.

`liveAnswers(registry, name, query)` from `liveAnswers.ts` projects one bound query's settled answers into `{ name, answered, current }`, for a screen driver's `withLiveAnswer`. A pushed result and an unchanged server rerun each count as an answer, so a story can wait for the push a command causes on a live query after the command itself has settled.

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

A self-only feature, such as a user's preferences, reads and changes only the signed-in account's records. Declare its contract with `keyScope: "session"`. The server chooses the account from request-local identity, so payloads carry no owner field, and reads and invalidations name a logical item key for the record:

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

The registry is required for session-scoped bindings. Query atoms and live connections belong in it; command and one-off query Effects execute through it. Explicit streams also run through its client, preserving the session transport and headers; disposing the registry ends those streams. Streams on ordinary contracts use the caller's client. A successful command invalidates its owner's keys, while a rejected command declares no invalidation. Ordinary contracts keep unscoped keys and the two-argument `bind` call.

Server subscriptions and committed writes use the same plain record, list and bucket keys, including for `keyScope: "session"`. A background worker needs no request identity or account prefix to refresh a session's query. Matching keys trigger the query's own read policy; authorized reads remain responsible for filtering rows to the viewer. A shared key can therefore trigger authorized rechecks for several accounts. Use model buckets to narrow that fan-out.

Client cache isolation belongs to the owning registry. `bind` supplies its opaque context automatically. Custom client coordination uses these helpers and context type:

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

`Resync` is an internal server reconciliation signal. When more than 256 hints accumulate behind a stalled subscription, pending keys collapse to one `Resync`; further hints are absorbed until it is consumed. PostgreSQL listener recovery also resynchronizes affected subscriptions. In either case, the server reruns the subscriber's queries and pushes changed results. `Resync` never asks the client to issue reads.

The `paused` atom at `api[LiveConnection]` suppresses applying pushed values to the screen while continuing to observe the stream. Its `status.pending` count saturates at 256. Unpausing reopens the subscription for a current authorized result and resets that count. Bindings on one client runtime share pause state.

A live query's result stays a native initial result with `waiting: true` from mount until its subscription delivers the first result. An explicit query refresh reopens its subscription, retaining its current value with `waiting: true` until the fresh result arrives. Retryable connection failures retain the current query value during reconnection. Declared query failures and read denials still reach the query's error channel.

Visible browser `online` and `visibilitychange` events reopen active subscriptions for current values. Supply an optional native `resume` source on `makeClient` or `bind` for application or network lifecycle events; it registers a callback and returns its cleanup function. `resumeWindow` selects an embedded browser window. Disposing the registry releases the source, query subscriptions and socket resources.

`status` exposes `connection`, `failure`, `needsResync` and `pending`. A resume keeps `connection` unchanged and sets `needsResync` until the reopened subscription delivers its first update, while the query results keep their values and report nothing pending. A typed stream rejection settles as `failed`; transport failures and defects retry with the existing jittered exponential backoff. A denied subscription stays refused through matching local invalidations and resume events; it reopens when the viewer changes or the query is refreshed explicitly. A matching local invalidation still retries a subscription that settled with another failure, such as a declared `NotFound`. An established subscription remains open after a policy denial so a later authorized change can restore its value. A `$changes` request is authorized as a whole; automatic query atoms subscribe separately so independent permissions remain independent.

Custom native hosts use `changesHandlerLayer`, `querySubscription(rpc, references, viewer)` and `subscribe(subscription, read)`. The authorized query runner is required and must use the same handler and read policy as an ordinary read; session-backed hosts must provide a fresh session context on each rerun. Platform's host supplies this composition. The caller owns consumption and interruption of a raw `$changes` stream, whose values are `Result`, `Unchanged` and `QueryReadDenied`.

Server adapters import `LiveServer` from `@shivaedev/contract/live-server/service.ts` and `liveServerLayer` from `@shivaedev/contract/live-server/layer.ts`. The Layer captures the server's Reactivity service and dispatcher. `register(keys)` provides a scoped registration with `replaceKeys`; `resync()` reconciles its active subscriptions. `makeLiveServer` supplies a standalone server using the same subscription engine. Server hints contain keys, never authoritative row data.

### Query policies, record keys and buckets

Contract groups carry their read-policy guard into native `RpcServer` hosts and Platform’s application host. An ordinary query evaluates its policy once per request, after identity middleware supplies `CurrentViewer` from its validated session. A false policy returns `QueryReadDenied` without running the handler. Native hosts need no policy middleware or guard Layer. Real HTTP stories exercise both hosts with allowed and denied counted policies; they prove this RPC boundary, not an application’s session or deployment policy. Platform’s application host refuses HTTP `$changes` calls with `WebSocketRequired`; subscriptions use its WebSocket protocol. Subscription delivery and pushed reruns continue to check current access.

A query declares its decoded input, result, `readPolicy` and `reads` together. `readPolicy(payload, viewer)` returns an Effect boolean. `viewer` is the session's `Option<{ id: string }>`; the browser does not send the identity. `signedIn` from `readPolicy.ts` allows any signed-in viewer and refuses a signed-out viewer. `QueryReadPolicy<Payload, E, R>` preserves typed failures and required services. Declare policy errors in the query's `rejections`; a failing access check reaches the client as its declared error, including during live reads. Only a successful `false` denies access. [Policy services](#policy-services) explains richer session requirements and where to provide implementations.

```ts
import { Option, Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { signedIn } from "@shivaedev/contract/readPolicy.ts";

const notes = collection("notes", Schema.Number, { userId: Schema.String });
const Mine = query("mine", {
	payload: { title: Schema.String },
	success: Schema.Array(Schema.String),
	readPolicy: signedIn,
	reads: (_input, viewer) => (Option.isSome(viewer) ? [notes.bucket.userId(viewer.value.id)] : []),
});
```

On a repository model, annotate tenant fields with `bucket()` from `@shivaedev/changes/buckets.ts` so writes announce the affected buckets. For an admin page spanning every tenant, declare `readsCollections` beside a permission read policy:

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

The application supplies the permission checker through `permissionReadPolicy(permission, check)`; `check` receives that permission and the current viewer, and must check the viewer's grant using server services. Its failures and service requirements flow through the query like any other read policy. Supply `SessionUser` with the application's identity middleware. The policy guards both calls and subscriptions, and runs again before queries rerun. `readsCollections` requires this policy at declaration: a `signedIn` or ordinary boolean policy fails TypeScript checking, and the server reports an untyped declaration with that policy as an Effect defect during host startup. The server also refuses collection queries changed to an ordinary policy after construction as `QueryReadDenied`. Tenant-facing queries use `notes.bucket.userId(viewerId)` instead.

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

The URL identifies the client configuration; the in-memory protocol opens no socket. The client's direct calls and bound query atoms use the real handlers, schema decoding and middleware. Live subscriptions use the supplied handlers and change source, and mounted queries refresh from their updates. Closing a subscription interrupts its server stream. The protocol does not add handlers or publish changes: provide the same live handlers and change source that the application serves over WebSocket.

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

| Module                     | Functions and schemas                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `operation.ts`             | `query(name, { payload?, success?, rejections?, readPolicy, reads, serverReads? })`; `command(name, { payload?, success?, rejections?, invalidates })`; `query(name, { payload?, *run, readPolicy?, reads, serverReads?, readsCollections?, success?, rejections? })` and `command(name, { payload?, *run, invalidates?, success?, rejections? })` with an Effect-returning `run`; `stream(name, { payload?, success, rejections?, reads })`.  |
| `contract.ts`              | `contract(name, { queries?, commands?, streams?, keyScope? })`, returning a native RPC group with `declaration: { name, queries, commands, streams, keyScope }`.                                                                                                                                                                                                                                                                               |
| `defineModule.ts`          | `defineModule({ name, operations, requires, middleware?, subject?, keyScope?, wire? })`, returning the module's contract.                                                                                                                                                                                                                                                                                                                      |
| `moduleHandlers.ts`        | `moduleHandlers(module)`, the module's handler Layer, requiring exactly its `requires`.                                                                                                                                                                                                                                                                                                                                                        |
| `clientContract.ts`        | `clientContract({ name, wire, payloads?, queries?, commands?, middleware?, subject?, keyScope? })`, the browser's contract of a module that generated files build.                                                                                                                                                                                                                                                                             |
| `clientMatchesModule.ts`   | `ClientMatchesModule<Client, Module>`, `true` when the browser's contract and the server module have the same RPCs, else `ClientDiffersFromModule`.                                                                                                                                                                                                                                                                                            |
| `rejection.ts`             | `fieldRejection(struct, fields?)`; lower-level `rejectionSet(specs)`, which constructs the rejection classes, union schema and failure helpers used by operations.                                                                                                                                                                                                                                                                             |
| `bind.ts`                  | `bind(contract, atomRpcService, { registry?, live?, resume?, resumeWindow? }?)`, requiring the registry for session-scoped contracts and exposing `{ query, run }` for queries, `{ run }` Effects for commands and `{ run }` native Streams for streams; `makeClient(contract, { url, protocol?, headers?, webSocketConstructor?, group?, registry?, live?, resume?, resumeWindow? })`, which builds the shared WebSocket client and binds it. |
| `clientKeys.ts`            | `KeyContext`, `clientReadKeys`, `clientInvalidationKeys`: registry-local cache keys for custom clients.                                                                                                                                                                                                                                                                                                                                        |
| `live.ts`                  | `LiveHint` schema; `live(runtime, { stream, keyContext?, resume?, retryDelay?, retryKeys? })`, exposing `connection`, `paused` and `status`.                                                                                                                                                                                                                                                                                                   |
| `querySubscription.ts`     | `querySubscription(rpc, references, viewer)` checks each referenced query, resolves its payload and server-derived keys, and captures its scopes and ongoing authorization.                                                                                                                                                                                                                                                                    |
| `live-server/service.ts`   | `LiveServer`, the shared live server service.                                                                                                                                                                                                                                                                                                                                                                                                  |
| `live-server/layer.ts`     | `liveServerLayer`, providing `LiveServer` and its dispatcher dependency, requiring `Reactivity`.                                                                                                                                                                                                                                                                                                                                               |
| `live-server/subscribe.ts` | `subscribe(subscription, read?)`, an Effect requiring `LiveServer` that returns an authorized subscription Stream with its policy and query-runner requirements.                                                                                                                                                                                                                                                                               |
| `makeLiveServer.ts`        | `makeLiveServer`, an Effect requiring `Reactivity` that creates scoped server hint streams and a `resync` Effect.                                                                                                                                                                                                                                                                                                                              |
| `readPolicy.ts`            | `QueryReadPolicy`, `Viewer`, `signedIn`, `CurrentViewer`; `authorizeReads(effect, request, viewer)` for direct handler reruns outside RPC middleware.                                                                                                                                                                                                                                                                                          |
| `ReadPolicyGuard.ts`       | `ReadPolicyGuard`, the defaulted middleware reference attached to contract queries; `readPolicyGuardLayer({ websocket? })`, an optional override that refuses HTTP `$changes` calls by default.                                                                                                                                                                                                                                                |
| `validateReadPolicies.ts`  | `validateReadPolicies(group)`, an Effect that fails with `MissingReadPolicies` when any served or subscribable query omits its policy.                                                                                                                                                                                                                                                                                                         |
| `readPolicyErrors.ts`      | `MissingReadPolicies` (boot), `MissingReadPolicy` (native-server request fallback) and `QueryReadDenied`.                                                                                                                                                                                                                                                                                                                                      |
| `CommandGuard.ts`          | `guardCommands(group)` places command publication inside viewer-providing middleware; `commandGuardLayer(boundary)` evaluates declared invalidations for that viewer and delegates publication to the host boundary.                                                                                                                                                                                                                           |
| `commandResult.ts`         | `commandResult({ result, invalidates })` contributes server-only keys from a guarded command handler and returns only its success value.                                                                                                                                                                                                                                                                                                       |
| `serverMetadata.ts`        | `KeyScope`, `QueryDefinition.definition`, `CommandInvalidation.invalidates`, `ChangesQueries.queries`, `ChangesQueries.resolve(references)` and `changesRpc(name, queries)` for server adapters.                                                                                                                                                                                                                                               |
| `queryKeys.ts`             | `queryKeys(queries, references, viewer?)` authorizes references and resolves payload and server-derived keys using the provided services.                                                                                                                                                                                                                                                                                                      |
| `QueryServerReads.ts`      | `QueryServerReads<Payload, E, R>`, the server-only resolver type.                                                                                                                                                                                                                                                                                                                                                                              |
| `resume.ts`                | `resumeSignal({ window?, native? })`, returning a native numeric signal atom.                                                                                                                                                                                                                                                                                                                                                                  |
| `querySignals.ts`          | `querySignals(query)` exposes completion counts and subscription status as a native atom.                                                                                                                                                                                                                                                                                                                                                      |
| `clientActivity.ts`        | `clientActivity(client)` exposes a native activity Stream with a `current` Effect; `isClientSettled(state)` checks commands and first query results; `isClientIdle(state)` checks all finite work; `activityScreenSignal(activity, settled?)` projects pending work for screen waits.                                                                                                                                                          |
| `liveAnswers.ts`           | `liveAnswers(registry, name, query)` counts a bound query's settled answers, pushed or unchanged, for screen waits.                                                                                                                                                                                                                                                                                                                            |

A bound query’s optional second argument accepts `headers` and `serializationKey`. Successful results remain in their owning registry for five minutes after the last reader leaves, up to 100 idle queries, evicting the least recently left first. Reopening a query immediately returns the retained success with native `waiting: true` while a new subscription or read supplies fresh data. Execution stops between readers. Configure the registry’s `queryRetention` atom from `@shivaedev/contract/queryRetention.ts` with `{ timeToLive: "1 minute", capacity: 50 }`, or set React’s `SessionBoundary` prop of the same name. Zero for either disables idle retention. Expiry runs on the query runtime’s Effect Clock. Registry disposal clears all retained results; applications outside `SessionBoundary` own that disposal when their session changes. A native resume source receives a callback and returns a cleanup function.

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

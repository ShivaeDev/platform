import { Context, Effect, Layer, Option, Schema, Stream } from "effect";
import { FetchHttpClient } from "effect/http";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import type * as Reactivity from "effect/reactivity/Reactivity";
import { RpcClient, RpcMiddleware, RpcSerialization } from "effect/rpc";
import type { RpcClientError } from "effect/rpc/RpcClientError";
import type { SqlError } from "effect/sql/SqlError";
import { NotFound } from "@shivaedev/errors/taxonomy.ts";
import { bind } from "#bind.ts";
import { contract } from "#contract.ts";
import { defineModule } from "#defineModule.ts";
import type { moduleHandlers } from "#moduleHandlers.ts";
import { command, query } from "#operation.ts";
import { permissionReadPolicy } from "#permissionReadPolicy.ts";
import type { MissingReadPolicy, QueryReadDenied } from "#readPolicyErrors.ts";
import * as ModuleNotes from "#test/moduleNotes.ts";
import { Create, type Denied, Get, Note, NoteMissing, Notes, notes, type Rename } from "#test/notes.ts";
import * as RunNotes from "#test/runNotes.ts";
import type { WebSocketRequired } from "#WebSocketRequired.ts";

export class Client extends AtomRpc.Service<Client>()("fixture/Client", {
	group: Notes,
	protocol: RpcClient.layerProtocolHttp({ url: "http://127.0.0.1/rpc" }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson])),
}) {}

export const api = bind(Notes, Client);

export const noteQuery: Atom.Atom<
	AsyncResult.AsyncResult<Note, NoteMissing | Denied | QueryReadDenied | RpcClientError | MissingReadPolicy | WebSocketRequired>
> = api.get.query({
	id: 1,
});
export const listQuery = api.list.query();
export const readOnce: Effect.Effect<Note, NoteMissing | Denied | QueryReadDenied | RpcClientError | MissingReadPolicy | WebSocketRequired, Client> =
	api.get.run({ id: 1 });

type Invalid = Effect.Error<ReturnType<typeof Rename.reject.Invalid>>;
export const invalidField: Invalid["field"] = "title";
export const rename: Effect.Effect<Note, NoteMissing | Invalid | Denied | RpcClientError, Client | Reactivity.Reactivity> = api.rename.run({
	id: 1,
	title: "t",
});
export const createInvalidField: Effect.Error<ReturnType<typeof Create.reject.Invalid>>["field"] = "body";
export const missing: Effect.Effect<never, NoteMissing> = Get.reject.NoteMissing({ id: 1 });
export const Inline = contract("inline", {
	commands: [command("touch", { invalidates: () => [notes.list] })],
	queries: [
		query("find", {
			payload: { id: Schema.Number },
			readPolicy: () => Effect.succeed(true),
			reads: ({ id }) => [notes.item(id)],
			rejections: { NoteMissing },
			success: Note,
		}),
	],
});
const [Find] = Inline.declaration.queries;
const [Touch] = Inline.declaration.commands;
export const touchSuccess: Schema.Void = Touch.success;
export const touchPayload: Schema.Void = Touch.payload;
export const touchError: Schema.Never = Touch.error;
export const touchRejects: [keyof typeof Touch.reject] extends [never] ? true : false = true;
export const findMissing: Effect.Effect<never, NoteMissing> = Find.reject.NoteMissing({ id: 1 });
export const inlineHandlers = Inline.of({
	"inline.$changes": () => Stream.never,
	"inline.find": ({ id }) => Effect.succeed(new Note({ body: "", id, title: "" })),
	"inline.touch": () => Effect.void,
});
export const handlers = Notes.of({
	"notes.$changes": () => Stream.never,
	"notes.create": (draft) => (draft.title === "" ? Create.reject.Invalid({ field: "title", message: "" }) : Effect.succeed({ id: 1, ...draft })),
	"notes.get": ({ id }) => (id > 0 ? Effect.succeed({ body: "", id, title: "" }) : Get.reject.NoteMissing({ id })),
	"notes.list": () => Effect.succeed([]),
	"notes.rename": ({ id, title }) => Effect.succeed({ body: "", id, title }),
});

export class FixtureAccount extends Context.Service<FixtureAccount, { readonly id: string }>()("@shivaedev/contract/FixtureAccount") {}

export const SubjectNotes = contract("subjectNotes", {
	commands: [command("touch", { invalidates: () => [] })],
	subject: {
		error: Schema.Never,
		middleware: Effect.succeed<RpcMiddleware.RpcMiddleware<FixtureAccount, never, never>>((effect) =>
			Effect.provideService(effect, FixtureAccount, { id: "alice" }),
		),
	},
});

type Services = RunNotes.NotesRepository | RunNotes.SessionUser;
export const createRun: Effect.Effect<RunNotes.Note, RunNotes.TitleTaken | SqlError, Services> = RunNotes.Create.run({ title: "Groceries" });
export const importRun: Effect.Effect<RunNotes.Note, RunNotes.TitleTaken | SqlError, Services | RunNotes.NoteSource> = RunNotes.Import.run({
	id: 1,
});
export const getRun: Effect.Effect<RunNotes.Note, NotFound | SqlError, Services> = RunNotes.Get.run({ id: 1 });
export const getPolicy: Effect.Effect<boolean, NotFound | SqlError, RunNotes.NotesRepository> = RunNotes.Get.readPolicy({ id: 1 }, Option.none());
export const listRun: Effect.Effect<readonly RunNotes.Note[], SqlError, Services> = RunNotes.List.run();
type Automatic = "InternalServerError" | "ServiceUnavailable";
type CreateTags = keyof typeof RunNotes.Create.rejections;
export const automaticTags: [CreateTags, Automatic] extends [Automatic, CreateTags] ? true : false = true;
export const RunContract = contract("runNotes", { commands: [RunNotes.Create, RunNotes.Import], queries: [RunNotes.Get, RunNotes.List] });
export const RunCreateAnnounced = command("createAnnounced", {
	invalidates: (_fields, note) => [RunNotes.runNotes.item(note.id)],
	payload: RunNotes.NoteFields,
	*run({ title }) {
		const { id: userId } = yield* RunNotes.SessionUser;
		return { id: 1, title, userId };
	},
	success: Schema.Struct({ id: Schema.Number, title: Schema.String, userId: Schema.String }),
});
export const RunDerived = query("derived", {
	payload: { scope: Schema.String },
	reads: () => [],
	*run({ scope }) {
		const { id } = yield* RunNotes.SessionUser;
		return `${id}: ${scope}`;
	},
	serverReads: ({ scope }) => Effect.succeed([RunNotes.runNotes.item(scope.length)]),
});
export const RunEveryNote = query("everyNote", {
	readPolicy: permissionReadPolicy({ name: "notes.read" }, (_permission, viewer) => Effect.succeed(Option.isSome(viewer))),
	reads: () => [],
	readsCollections: [{ name: "runNotes" }],
	*run() {
		const { id } = yield* RunNotes.SessionUser;
		return id;
	},
});

export class SessionGuard extends RpcMiddleware.Service<SessionGuard, { provides: RunNotes.SessionUser }>()(
	"@shivaedev/contract/test/SessionGuard",
) {}
export const SessionNotes = defineModule({
	middleware: SessionGuard,
	name: "sessionNotes",
	operations: [
		command("rename", {
			payload: { id: Schema.Number, title: Schema.String },
			rejections: { NotFound },
			*run({ id, title }) {
				const repository = yield* RunNotes.NotesRepository;
				const { id: userId } = yield* RunNotes.SessionUser;
				const note = yield* repository.findOne(id, userId);
				return Option.isSome(note) ? title : yield* new NotFound({ message: "Note not found" });
			},
			success: Schema.String,
		}),
	],
	requires: [RunNotes.NotesRepository],
});
type Requirements<TLayer> = TLayer extends Layer.Layer<infer _A, infer _E, infer R> ? R : never;
type SessionNotesNeeds = Requirements<ReturnType<typeof moduleHandlers<typeof SessionNotes>>>;
export const sessionNotesNeedRequires: [SessionNotesNeeds, RunNotes.NotesRepository] extends [RunNotes.NotesRepository, SessionNotesNeeds]
	? true
	: false = true;
type ModuleNotesNeeds = Requirements<ReturnType<typeof moduleHandlers<typeof ModuleNotes.Notes>>>;
export const moduleNotesNeedRequires: [ModuleNotesNeeds, ModuleNotes.NotesStore] extends [ModuleNotes.NotesStore, ModuleNotesNeeds] ? true : false =
	true;
export class ModuleClient extends AtomRpc.Service<ModuleClient>()("fixture/ModuleClient", {
	group: ModuleNotes.Notes,
	protocol: RpcClient.layerProtocolHttp({ url: "http://127.0.0.1/rpc" }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson])),
}) {}
export const moduleApi = bind(ModuleNotes.Notes, ModuleClient);
export const moduleList: Atom.Atom<AsyncResult.AsyncResult<readonly (typeof ModuleNotes.Note.Type)[], unknown>> = moduleApi.list.query();

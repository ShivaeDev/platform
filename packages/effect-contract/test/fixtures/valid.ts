import { Effect, Layer, Schema } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRpc from "effect/unstable/reactivity/AtomRpc";
import type * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import type { RpcClientError } from "effect/unstable/rpc/RpcClientError";
import { bind, command, contract, query } from "#index.ts";
import { Create, type Denied, Get, Note, NoteMissing, Notes, notes, type Rename } from "#test/notes.ts";

export class Client extends AtomRpc.Service<Client>()("fixture/Client", {
	group: Notes,
	protocol: RpcClient.layerProtocolHttp({ url: "http://127.0.0.1/rpc" }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson])),
}) {}

export const api = bind(Notes, Client);

export const noteQuery: Atom.Atom<AsyncResult.AsyncResult<Note, NoteMissing | Denied | RpcClientError>> = api.get.query({ id: 1 });
export const listQuery = api.list.query();
export const readOnce: Effect.Effect<Note, NoteMissing | Denied | RpcClientError, Client> = api.get.run({ id: 1 });

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
	queries: [query("find", { payload: { id: Schema.Number }, reads: ({ id }) => [notes.item(id)], rejections: { NoteMissing }, success: Note })],
});
const [Find] = Inline.declaration.queries;
const [Touch] = Inline.declaration.commands;
export const touchSuccess: Schema.Void = Touch.success;
export const touchPayload: Schema.Void = Touch.payload;
export const touchError: Schema.Never = Touch.error;
export const touchRejects: [keyof typeof Touch.reject] extends [never] ? true : false = true;
export const findMissing: Effect.Effect<never, NoteMissing> = Find.reject.NoteMissing({ id: 1 });
export const inlineHandlers = Inline.of({
	"inline.find": ({ id }) => Effect.succeed(new Note({ body: "", id, title: "" })),
	"inline.touch": () => Effect.void,
});
export const handlers = Notes.of({
	"notes.create": (draft) => (draft.title === "" ? Create.reject.Invalid({ field: "title", message: "" }) : Effect.succeed({ id: 1, ...draft })),
	"notes.get": ({ id }) => (id > 0 ? Effect.succeed({ body: "", id, title: "" }) : Get.reject.NoteMissing({ id })),
	"notes.list": () => Effect.succeed([]),
	"notes.rename": ({ id, title }) => Effect.succeed({ body: "", id, title }),
});

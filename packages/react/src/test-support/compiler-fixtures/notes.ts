import { Effect, Schema, Stream } from "effect";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { bind } from "@shivaedev/contract/bind.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";

export const Note = Schema.Struct({ id: Schema.Number, title: Schema.String, version: Schema.Number, words: Schema.Number });
const NoteId = { id: Schema.Number };
const Get = query("get", { payload: NoteId, readPolicy: () => Effect.succeed(true), reads: () => [], rejections: {}, success: Note });
const Create = command("create", { invalidates: () => [], payload: { title: Schema.String }, rejections: {}, success: Note });
const Update = command("update", {
	invalidates: () => [],
	payload: { ...NoteId, title: Schema.String, version: Schema.Number },
	rejections: {},
	success: Note,
});
const Rename = command("rename", {
	invalidates: () => [],
	payload: { expectedVersion: Schema.Number, ...NoteId, title: Schema.String },
	rejections: {},
	success: Note,
});
const Remove = command("remove", { invalidates: () => [], payload: NoteId, rejections: {}, success: Schema.Void });
const Notes = contract("notes", { commands: [Create, Update, Rename, Remove], queries: [Get] });

class Client extends AtomRpc.Service<Client>()("fixture/NotesClient", {
	group: Notes,
	makeEffect: RpcTest.makeClient(Notes, { flatten: true }),
	protocol: Notes.toLayer({
		"notes.$changes": () => Stream.never,
		"notes.create": ({ title }) => Effect.succeed({ id: 1, title, version: 1, words: 0 }),
		"notes.get": ({ id }) => Effect.succeed({ id, title: "", version: 1, words: 0 }),
		"notes.remove": () => Effect.void,
		"notes.rename": ({ id, title }) => Effect.succeed({ id, title, version: 2, words: 0 }),
		"notes.update": ({ id, title, version }) => Effect.succeed({ id, title, version, words: 0 }),
	}),
}) {}

export const api = bind(Notes, Client, { live: false });

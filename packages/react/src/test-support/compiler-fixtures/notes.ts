import { Effect, Schema } from "effect";
import { contract } from "@shivaedev/contract/contract.ts";
import { makeClient } from "@shivaedev/contract/makeClient.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { Conflict } from "@shivaedev/errors/taxonomy.ts";
import { layerLiveMemoryProtocol } from "@shivaedev/test-kits/contract/liveMemoryProtocol.ts";

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
export class SubtitleRejected extends Schema.TaggedError<SubtitleRejected>()("SubtitleRejected", { message: Schema.String }) {}
const Retitle = command("retitle", {
	invalidates: () => [],
	payload: { ...NoteId, title: Schema.String },
	rejections: { Conflict, SubtitleRejected },
	success: Note,
});
const Remove = command("remove", { invalidates: () => [], payload: NoteId, rejections: {}, success: Schema.Void });
const Notes = contract("notes", { commands: [Create, Update, Rename, Retitle, Remove], queries: [Get] });

export const api = makeClient(
	{ notes: Notes },
	{
		protocol: layerLiveMemoryProtocol(
			Notes,
			Notes.application.toLayer({
				"notes.create": ({ title }) => Effect.succeed({ id: 1, title, version: 1, words: 0 }),
				"notes.get": ({ id }) => Effect.succeed({ id, title: "", version: 1, words: 0 }),
				"notes.remove": () => Effect.void,
				"notes.rename": ({ id, title }) => Effect.succeed({ id, title, version: 2, words: 0 }),
				"notes.retitle": ({ id, title }) => Effect.succeed({ id, title, version: 2, words: 0 }),
				"notes.update": ({ id, title, version }) => Effect.succeed({ id, title, version, words: 0 }),
			}),
		),
	},
).api.notes;

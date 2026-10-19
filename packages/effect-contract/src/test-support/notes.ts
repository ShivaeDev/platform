import { Context, Schema } from "effect";
import { RpcMiddleware } from "effect/rpc";
import { contract } from "#contract.ts";
import { collection } from "#keys.ts";
import { command, query } from "#operation.ts";
import { fieldRejection } from "#rejection.ts";

export class Note extends Schema.Class<Note>("Note")({ body: Schema.String, id: Schema.Number, title: Schema.String }) {}
export const Draft = Schema.Struct({ body: Schema.String, title: Schema.String });
export class NoteMissing extends Schema.TaggedError<NoteMissing>()("NoteMissing", { id: Schema.Number }) {}
export class Denied extends Schema.TaggedError<Denied>()("Denied", {}) {}
export class Session extends Context.Service<Session, { readonly user: string }>()("test/Session") {}
export class Guard extends RpcMiddleware.Service<Guard, { provides: Session }>()("test/Guard", { error: Denied }) {}

export const notes = collection("notes", Note.fields.id);

export const Get = query("get", {
	payload: { id: Schema.Number },
	reads: ({ id }) => [notes.item(id)],
	rejections: { NoteMissing },
	success: Note,
});
export const List = query("list", { reads: () => [notes.list], success: Schema.Array(Note) });
export const Rename = command("rename", {
	invalidates: ({ id }) => [notes.item(id)],
	payload: { id: Schema.Number, title: Schema.String },
	rejections: { Invalid: fieldRejection(Draft, ["title"]), NoteMissing },
	success: Note,
});
export const Create = command("create", {
	invalidates: (_draft, note) => [notes.item(note.id)],
	payload: Draft,
	rejections: { Invalid: fieldRejection(Draft) },
	success: Note,
});

export const Notes = contract("notes", { commands: [Rename, Create], queries: [Get, List] }).middleware(Guard);

import { Schema } from "effect";
import { Model } from "effect/schema";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { Conflict, NotFound, ServiceUnavailable } from "@shivaedev/effect-contract/errors/taxonomy.ts";
import { collection } from "@shivaedev/effect-contract/keys.ts";
import { command, query } from "@shivaedev/effect-contract/operation.ts";
import { fieldRejection } from "@shivaedev/effect-contract/rejection.ts";
import { AuthenticatedUser } from "@shivaedev/platform/rpc/middleware.ts";

export class Note extends Model.Class<Note>("Note")({
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	title: Schema.NonEmptyString,
	version: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	wordCount: Schema.NullOr(Schema.Number),
}) {}
export const NoteFields = Schema.Struct({ title: Note.fields.title });
export const NoteEditFields = Schema.Struct({ title: Note.fields.title, version: Note.fields.version });
const NoteId = Schema.Struct({ id: Schema.Number });
const NoteVersion = Schema.Struct({ ...NoteId.fields, version: Note.fields.version });
export const notes = collection("notes", Schema.Number);
export const Get = query("get", {
	payload: NoteId,
	reads: ({ id }) => [notes.item(id)],
	rejections: { NotFound, ServiceUnavailable },
	success: Note.json,
});
export const List = query("list", {
	reads: () => [notes.list],
	rejections: { ServiceUnavailable },
	success: Schema.Array(Note.json),
});
export const Create = command("create", {
	invalidates: (_input, row) => [notes.item(row.id)],
	payload: NoteFields,
	rejections: { Invalid: fieldRejection(NoteFields), ServiceUnavailable },
	success: Note.json,
});
export const Update = command("update", {
	invalidates: ({ id }) => [notes.item(id)],
	payload: Schema.Struct({ ...NoteId.fields, ...NoteEditFields.fields }),
	rejections: { Conflict, Invalid: fieldRejection(NoteEditFields), NotFound, ServiceUnavailable },
	success: Note.json,
});
export const Delete = command("delete", {
	invalidates: ({ id }) => [notes.item(id)],
	payload: NoteVersion,
	rejections: { Conflict, NotFound, ServiceUnavailable },
	success: Schema.Void,
});
export const Whoami = query("whoami", {
	reads: () => [],
	success: Schema.Struct({ email: Schema.String, id: Schema.String, name: Schema.String }),
});
export const Notes = contract("notes", { commands: [Create, Update, Delete], queries: [List, Get, Whoami] }).middleware(AuthenticatedUser);

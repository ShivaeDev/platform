import { Schema } from "effect";
import { Model } from "effect/schema";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { signedIn } from "@shivaedev/contract/readPolicy.ts";
import { fieldRejection } from "@shivaedev/contract/rejection.ts";
import { Conflict, InternalServerError, NotFound, ServiceUnavailable, TooManyRequests } from "@shivaedev/errors/taxonomy.ts";
import { AuthenticatedUser } from "@shivaedev/identity/middleware.ts";

export const noteFields = {
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	title: Schema.Trim.check(Schema.isNonEmpty({ message: "Enter a title" })),
	version: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	wordCount: Schema.NullOr(Schema.Number),
};
export class Note extends Model.Class<Note>("Note")(noteFields) {}
export const NoteFields = Schema.Struct({ title: Note.fields.title });
export const NoteEditFields = Schema.Struct({ title: Note.fields.title, version: Note.fields.version });
const NoteId = Schema.Struct({ id: Schema.Number });
const NoteVersion = Schema.Struct({ ...NoteId.fields, version: Note.fields.version });
export const notes = collection("notes", Schema.Number, { userId: Schema.String });
const Get = query("get", {
	payload: NoteId,
	readPolicy: signedIn,
	rejections: { InternalServerError, NotFound, ServiceUnavailable },
	success: Note.json,
});
const List = query("list", {
	readPolicy: signedIn,
	rejections: { InternalServerError, ServiceUnavailable },
	success: Schema.Array(Note.json),
});
export const Create = command("create", {
	invalidates: () => [],
	payload: NoteFields,
	rejections: { Conflict, InternalServerError, Invalid: fieldRejection(NoteFields), ServiceUnavailable, TooManyRequests },
	success: Note.json,
});
export const Import = command("import", {
	invalidates: () => [],
	payload: NoteId,
	rejections: { Conflict, InternalServerError, Invalid: fieldRejection(NoteFields), NotFound, ServiceUnavailable, TooManyRequests },
	success: Note.json,
});
export const Update = command("update", {
	invalidates: () => [],
	payload: Schema.Struct({ ...NoteId.fields, ...NoteEditFields.fields }),
	rejections: { Conflict, InternalServerError, Invalid: fieldRejection(NoteEditFields), NotFound, ServiceUnavailable },
	success: Note.json,
});
export const Delete = command("delete", {
	invalidates: () => [],
	payload: NoteVersion,
	rejections: { Conflict, InternalServerError, NotFound, ServiceUnavailable },
	success: Schema.Void,
});
export const Notes = contract("notes", { commands: [Create, Import, Update, Delete], queries: [List, Get] }).middleware(AuthenticatedUser);

import { Context, Effect, Option, Schema } from "effect";
import { Model } from "effect/schema";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { fieldRejection } from "@shivaedev/contract/rejection.ts";
import { Conflict, InternalServerError, NotFound, ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { AuthenticatedUser } from "@shivaedev/identity/middleware.ts";

export class Note extends Model.Class<Note>("Note")({
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	title: Schema.Trim.check(Schema.isNonEmpty({ message: "Enter a title" })),
	version: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	wordCount: Schema.NullOr(Schema.Number),
}) {}
export const NoteFields = Schema.Struct({ title: Note.fields.title });
export const NoteEditFields = Schema.Struct({ title: Note.fields.title, version: Note.fields.version });
const NoteId = Schema.Struct({ id: Schema.Number });
const NoteVersion = Schema.Struct({ ...NoteId.fields, version: Note.fields.version });
export const notes = collection("notes", Schema.Number, { userId: Schema.String });
export class NoteReadAccess extends Context.Service<NoteReadAccess, (id: number, userId: string) => Effect.Effect<boolean>>()("app/NoteReadAccess") {}
export const Get = query("get", {
	payload: NoteId,
	readPolicy: ({ id }, viewer) =>
		Option.isNone(viewer) ? Effect.succeed(false) : Effect.flatMap(NoteReadAccess, (canRead) => canRead(id, viewer.value.id)),
	reads: ({ id }) => [notes.item(id)],
	rejections: { InternalServerError, NotFound, ServiceUnavailable },
	success: Note.json,
});
export const List = query("list", {
	readPolicy: (_input, viewer) => Effect.succeed(Option.isSome(viewer)),
	reads: (_input, viewer) => (Option.isSome(viewer) ? [notes.bucket.userId(viewer.value.id)] : []),
	rejections: { InternalServerError, ServiceUnavailable },
	success: Schema.Array(Note.json),
});
export const Create = command("create", {
	invalidates: () => [],
	payload: NoteFields,
	rejections: { Conflict, InternalServerError, Invalid: fieldRejection(NoteFields), ServiceUnavailable },
	success: Note.json,
});
export const Import = command("import", {
	invalidates: () => [],
	payload: NoteId,
	rejections: { Conflict, InternalServerError, Invalid: fieldRejection(NoteFields), NotFound, ServiceUnavailable },
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

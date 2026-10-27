import { Context, Effect, Option, Schema } from "effect";
import { Model } from "effect/schema";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { fieldRejection } from "@shivaedev/contract/rejection.ts";
import { Conflict, NotFound, ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { AuthenticatedUser } from "@shivaedev/identity/middleware.ts";

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
export const notes = collection("notes", Schema.Number, { userId: Schema.String });
export class NoteReadAccess extends Context.Service<NoteReadAccess, (id: number, userId: string) => Effect.Effect<boolean>>()("app/NoteReadAccess") {}
export const Get = query("get", {
	payload: NoteId,
	readPolicy: ({ id }, viewer) =>
		Option.isNone(viewer) ? Effect.succeed(false) : Effect.flatMap(NoteReadAccess, (canRead) => canRead(id, viewer.value.id)),
	reads: ({ id }) => [notes.item(id)],
	rejections: { NotFound, ServiceUnavailable },
	success: Note.json,
});
export const List = query("list", {
	readPolicy: (_input, viewer) => Effect.succeed(Option.isSome(viewer)),
	reads: (_input, viewer) => (Option.isSome(viewer) ? [notes.bucket.userId(viewer.value.id)] : []),
	rejections: { ServiceUnavailable },
	success: Schema.Array(Note.json),
});
export const Create = command("create", {
	invalidates: (_input, row, viewer = Option.none()) => [
		notes.item(row.id),
		...(Option.isSome(viewer) ? [notes.bucket.userId(viewer.value.id)] : []),
	],
	payload: NoteFields,
	rejections: { Invalid: fieldRejection(NoteFields), ServiceUnavailable },
	success: Note.json,
});
export const Update = command("update", {
	invalidates: ({ id }, _result, viewer = Option.none()) => [
		notes.item(id),
		...(Option.isSome(viewer) ? [notes.bucket.userId(viewer.value.id)] : []),
	],
	payload: Schema.Struct({ ...NoteId.fields, ...NoteEditFields.fields }),
	rejections: { Conflict, Invalid: fieldRejection(NoteEditFields), NotFound, ServiceUnavailable },
	success: Note.json,
});
export const Delete = command("delete", {
	invalidates: ({ id }, _result, viewer = Option.none()) => [
		notes.item(id),
		...(Option.isSome(viewer) ? [notes.bucket.userId(viewer.value.id)] : []),
	],
	payload: NoteVersion,
	rejections: { Conflict, NotFound, ServiceUnavailable },
	success: Schema.Void,
});
export const Whoami = query("whoami", {
	readPolicy: (_input, viewer) => Effect.succeed(Option.isSome(viewer)),
	reads: () => [],
	success: Schema.Struct({ email: Schema.String, id: Schema.String, name: Schema.String }),
});
export const Notes = contract("notes", { commands: [Create, Update, Delete], queries: [List, Get, Whoami] }).middleware(AuthenticatedUser);

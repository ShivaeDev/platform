import { Schema } from "effect";
import { Model } from "effect/schema";
import { collection } from "@shivaedev/changes/keys.ts";

export const noteFields = {
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	title: Schema.Trim.check(Schema.isNonEmpty({ message: "Enter a title" })),
	version: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	wordCount: Schema.NullOr(Schema.Number),
};
export class Note extends Model.Class<Note>("Note")(noteFields) {}
export const NoteFields = Schema.Struct({ title: Note.fields.title });
export const NoteEditFields = Schema.Struct({ title: Note.fields.title, version: Note.fields.version });
export const NoteId = Schema.Struct({ id: Schema.Number });
export const NoteVersion = Schema.Struct({ ...NoteId.fields, version: Note.fields.version });
export const NoteEdit = Schema.Struct({ ...NoteId.fields, ...NoteEditFields.fields });
export const notes = collection("notes", Schema.Number, { userId: Schema.String });

export function toNote({ id, title, version, wordCount }: typeof Note.json.Type): typeof Note.json.Type {
	return { id, title, version, wordCount };
}

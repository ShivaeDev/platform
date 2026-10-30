import { Schema } from "effect";
import { Model } from "effect/schema";
import { bucket } from "@shivaedev/changes/buckets.ts";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import { Note } from "#modules/notes/notes.ts";

export class StoredNote extends Model.Class<StoredNote>("StoredNote")({
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	title: Note.fields.title,
	userId: bucket(Schema.NullOr(Schema.String)),
	version: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	wordCount: Note.fields.wordCount,
}) {}

export const makeNotesRepository = makeRepository(StoredNote, {
	idColumn: "id",
	spanPrefix: "Notes",
	tableName: "notes",
	versionColumn: "version",
});

import { Schema } from "effect";
import { Model } from "effect/unstable/schema";
import { makeRepository } from "@shivaedev/effect-sql/repository.ts";
import { Note } from "#notes.ts";

class StoredNote extends Model.Class<StoredNote>("StoredNote")({
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	ownerId: Schema.NullOr(Schema.String),
	title: Note.fields.title,
	wordCount: Note.fields.wordCount,
}) {}

export const makeNotesRepository = makeRepository(StoredNote, {
	idColumn: "id",
	spanPrefix: "Notes",
	tableName: "starter_notes",
});

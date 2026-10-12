import { Schema } from "effect";
import { Model } from "effect/unstable/schema";
import { makeRepository } from "@shivaedev/effect-sql/repository.ts";

export class NoteRow extends Model.Class<NoteRow>("NoteRow")({
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	title: Schema.String,
}) {}

export const makeNotesRepository = makeRepository(NoteRow, {
	idColumn: "id",
	spanPrefix: "Notes",
	tableName: "starter_notes",
});

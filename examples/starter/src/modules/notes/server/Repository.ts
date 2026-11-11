import { Schema } from "effect";
import { Model } from "effect/schema";
import { bucket } from "@shivaedev/changes/buckets.ts";
import { defineRepository } from "@shivaedev/sql/defineRepository.ts";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import { noteFields, notes } from "#modules/notes/model.ts";

class StoredNote extends Model.Class<StoredNote>("StoredNote")({
	...noteFields,
	userId: bucket(Schema.NullOr(Schema.String)),
}) {}

const makeNotesRepository = makeRepository(StoredNote, {
	collection: notes,
	idColumn: "id",
	spanPrefix: "Notes",
	tableName: "notes",
	versionColumn: "version",
});

export const NotesRepository = defineRepository({ id: "app/NotesRepository", initialize: makeNotesRepository });

import { Schema } from "effect";
import { Model } from "effect/schema";
import { bucket } from "@shivaedev/changes/buckets.ts";
import { defineRepository } from "@shivaedev/sql/defineRepository.ts";
import { owner } from "@shivaedev/sql/owner.ts";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import { noteFields, notes } from "#modules/notes/model.ts";

class StoredNote extends Model.Class<StoredNote>("StoredNote")({
	...noteFields,
	userId: owner(bucket(Schema.NullOr(Schema.String))),
}) {}

const makeNotesRepository = makeRepository(StoredNote, { collection: notes, versionColumn: "version" });

export const NotesRepository = defineRepository({ id: "app/NotesRepository", initialize: makeNotesRepository });

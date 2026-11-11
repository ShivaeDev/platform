import { Schema } from "effect";
import { Model } from "effect/schema";
import { bucket } from "@shivaedev/changes/buckets.ts";
import { collection } from "@shivaedev/changes/keys.ts";

export const notes = collection("notes", Schema.Number, { owner: Schema.String });

export class NoteRow extends Model.Class<NoteRow>("NoteRow")({
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	owner: bucket(Schema.String),
	title: Schema.String,
}) {}

export class Note extends Schema.Class<Note>("Note")({ id: Schema.Number, owner: Schema.String, title: Schema.String }) {}

export const NoteFields = Schema.Struct({ title: Schema.String });

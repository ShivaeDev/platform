import { Schema } from "effect";
import { Model } from "effect/unstable/schema";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { collection } from "@shivaedev/effect-contract/keys.ts";
import { command, query } from "@shivaedev/effect-contract/operation.ts";
import { fieldRejection } from "@shivaedev/effect-contract/rejection.ts";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { Authenticated } from "@shivaedev/platform/rpc/middleware.ts";

export class Note extends Model.Class<Note>("Note")({
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	title: Schema.NonEmptyString,
}) {}
export const NoteFields = Note.insert;
export const notes = collection("starterNotes", Schema.Number);
export const List = query("list", {
	reads: () => [notes.list],
	rejections: { ServiceUnavailable },
	success: Schema.Array(Note.json),
});
export const Create = command("create", {
	invalidates: (_input, row) => [notes.item(row.id)],
	payload: NoteFields,
	rejections: { Invalid: fieldRejection(NoteFields), ServiceUnavailable },
	success: Note.json,
});
export const Notes = contract("notes", { commands: [Create], queries: [List] }).middleware(Authenticated);

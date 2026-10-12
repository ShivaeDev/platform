import { Schema } from "effect";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { collection } from "@shivaedev/effect-contract/keys.ts";
import { command, query } from "@shivaedev/effect-contract/operation.ts";
import { fieldRejection } from "@shivaedev/effect-contract/rejection.ts";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";

export const Note = Schema.Struct({ id: Schema.Number, title: Schema.String });
export const NoteFields = Schema.Struct({ title: Schema.NonEmptyString });
export const notes = collection("starterNotes", Schema.Number);
export const List = query("list", {
	reads: () => [notes.list],
	rejections: { ServiceUnavailable },
	success: Schema.Array(Note),
});
export const Create = command("create", {
	invalidates: (_input, row) => [notes.item(row.id)],
	payload: NoteFields,
	rejections: { Invalid: fieldRejection(NoteFields), ServiceUnavailable },
	success: Note,
});
export const Notes = contract("notes", { commands: [Create], queries: [List] });

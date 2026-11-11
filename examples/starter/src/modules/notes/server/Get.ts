import { query } from "@shivaedev/contract/operation.ts";
import { NoteId, toNote } from "#modules/notes/model.ts";
import { ownedNote } from "#modules/notes/server/owned.ts";

export const Get = query("get", {
	payload: NoteId,
	*run({ id }) {
		return toNote(yield* ownedNote(id));
	},
});

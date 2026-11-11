import { Effect } from "effect";
import { command } from "@shivaedev/contract/operation.ts";
import { NoteVersion } from "#modules/notes/model.ts";
import { changed } from "#modules/notes/server/changed.ts";
import { ownedNote } from "#modules/notes/server/owned.ts";
import { NotesRepository } from "#modules/notes/server/Repository.ts";

export const Delete = command("delete", {
	payload: NoteVersion,
	*run({ id, version }) {
		const repository = yield* NotesRepository;
		yield* ownedNote(id);
		yield* repository.delete(id, version).pipe(Effect.catchTag("OptimisticConcurrencyError", changed));
	},
});

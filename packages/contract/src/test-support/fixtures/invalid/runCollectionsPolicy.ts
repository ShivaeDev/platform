import { query } from "#operation.ts";
import { runNotes, SessionUser } from "#test/runNotes.ts";

query("everyNote", {
	reads: () => [],
	readsCollections: [{ name: runNotes.name }],
	*run() {
		const { id } = yield* SessionUser;
		return id;
	},
});

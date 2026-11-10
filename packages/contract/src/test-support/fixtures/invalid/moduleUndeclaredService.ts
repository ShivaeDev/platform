import { Schema } from "effect";
import { defineModule } from "#defineModule.ts";
import { command } from "#operation.ts";
import { NoteId, NoteSource, SessionUser } from "#test/runNotes.ts";

const ImportTitle = command("importTitle", {
	payload: NoteId,
	*run({ id }) {
		const source = yield* NoteSource;
		return yield* source.title(id);
	},
	success: Schema.String,
});

const Whoami = command("whoami", {
	*run() {
		const { id } = yield* SessionUser;
		return id;
	},
	success: Schema.String,
});

defineModule({
	name: "imports",
	operations: [ImportTitle, Whoami],
	requires: [SessionUser],
});

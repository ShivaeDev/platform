import { defineModule } from "#defineModule.ts";
import { Create, NotesRepository, SessionUser } from "#test/runNotes.ts";

defineModule({
	name: "creates",
	operations: [Create],
	requires: [NotesRepository, SessionUser],
});

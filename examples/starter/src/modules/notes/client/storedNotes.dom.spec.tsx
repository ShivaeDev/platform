import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { notesOpenWithStorage, storedNotes } from "#modules/notes/test-support/stored.tsx";

storedNotes.it(
	"a reload shows the stored notes in the first render, marked as updating, then the host's list",
	[notesOpenWithStorage],
	function* ({ noteRevisedElsewhere, releaseNotesList, reload, shownNotes, updating }) {
		yield* noteRevisedElsewhere("Revised note");

		yield* reload();

		yield* outcomes([
			["notes", shownNotes, ["First note"]],
			["updating", updating, true],
		]);

		yield* releaseNotesList();

		yield* outcomes([
			["notes", shownNotes, ["Revised note"]],
			["updating", updating, false],
		]);
	},
);

import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { noteDeleteControls, savedNotes, screens } from "#modules/notes/test-support/screens.ts";

screens.it(
	"deleting one note completes only its control and leaves the other note's delete state unchanged",
	[savedNotes("Keep this note", "Delete this note"), noteDeleteControls()],
	function* ({ deleteNote, deleteState, settle }) {
		const untouched = { button: "Delete note, enabled", completion: "Not deleted" };
		yield* outcomes([
			["requested note before", () => deleteState("Delete this note"), untouched],
			["other note before", () => deleteState("Keep this note"), untouched],
		]);

		yield* deleteNote("Delete this note");
		yield* settle();

		yield* outcomes([
			["requested note", () => deleteState("Delete this note"), { completion: "Deleted" }],
			["other note", () => deleteState("Keep this note"), untouched],
		]);
	},
);

import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { notesRoute, savedNotes, screens } from "#modules/notes/test-support/screens.ts";

screens.it(
	"the notes table lists the newest note first and links each title to its note",
	[savedNotes("Apple", "Zebra"), notesRoute()],
	function* ({ noteLinks }) {
		expect(yield* noteLinks()).toEqual(["Zebra links to /notes/2", "Apple links to /notes/1"]);
	},
);

for (const [clicks, direction, titles] of [
	[1, "ascending", ["Apple", "Zebra"]],
	[2, "descending", ["Zebra", "Apple"]],
] as const) {
	screens.it(
		`sorting by title ${clicks === 1 ? "once" : "twice"} orders the notes ${direction}`,
		[savedNotes("Apple", "Zebra"), notesRoute()],
		function* ({ shownNotes, sortsByTitle, titleSort }) {
			expect(yield* titleSort()).toBe("none");

			for (let click = 0; click < clicks; click += 1) {
				yield* sortsByTitle();
			}

			yield* outcomes([
				["notes", shownNotes, titles],
				["title column", titleSort, direction],
			]);
		},
	);
}

import { expect } from "vitest";
import { notesApp, notesHostScreen, signedInAccount } from "#modules/notes/test-support/app.tsx";

notesApp.it(
	"a missing note shows a not-found screen against the real host and returns to the list",
	[signedInAccount(), notesHostScreen("/notes/12345")],
	function* ({ settle, heading, button, followLink, screenText, route }) {
		yield* settle();
		expect(heading()).toBe("Note not found");
		expect(button("Retry")).toBeUndefined();
		expect(route()).toBe("/notes/12345");
		yield* followLink("Back to notes");
		yield* settle();
		expect(heading()).toBe("Notes");
		expect(screenText()).toContain("No notes yet");
	},
);

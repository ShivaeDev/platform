import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { notesApp, notesHostScreen, signedInAccount } from "#modules/notes/test-support/app.tsx";

notesApp.it(
	"a missing note shows a not-found screen against the real host and returns to the list",
	[signedInAccount(), notesHostScreen("/notes/12345")],
	function* ({ heading, button, followLink, screenText, route }) {
		yield* Effect.promise(() => eventually(() => expect(heading()).toBe("Note not found")));
		expect(button("Retry")).toBeUndefined();
		expect(route()).toBe("/notes/12345");
		yield* followLink("Back to notes");
		yield* Effect.promise(() => eventually(() => expect(heading()).toBe("Notes")));
		expect(screenText()).toContain("No notes yet");
	},
);

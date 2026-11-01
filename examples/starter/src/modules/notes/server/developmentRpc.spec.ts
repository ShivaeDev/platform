import { expect } from "vitest";
import { app, signedIn, throughDevelopmentServer } from "#modules/notes/test-support/application.ts";

app.it(
	"through the development server's socket, alice's open notes list receives her new note",
	[signedIn("alice"), throughDevelopmentServer()],
	function* ({ notesOf, watchesNotes }) {
		const aliceList = yield* watchesNotes("alice");
		expect(yield* aliceList.nextList()).toEqual([]);

		const note = yield* notesOf("alice").create("A note through the dev proxy");

		expect(yield* aliceList.nextList()).toEqual([note]);
	},
);

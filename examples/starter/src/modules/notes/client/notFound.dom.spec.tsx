import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { notesApp, notesHostScreen, signedInAccount } from "#modules/notes/test-support/app.tsx";

notesApp.it(
	"a missing note shows Note not found without offering Retry",
	[signedInAccount(), notesHostScreen("/notes/12345")],
	function* ({ heading, offers, route, settle }) {
		yield* settle();

		yield* outcomes([
			["page", heading, "Note not found"],
			["route", route, "/notes/12345"],
			["Retry", () => offers("Retry"), "not offered"],
		]);
	},
);

notesApp.it(
	"Back to notes from a missing note returns to alice's notes list",
	[signedInAccount(), notesHostScreen("/notes/12345")],
	function* ({ followLink, heading, settle, shownNotes }) {
		yield* settle();
		expect(yield* heading()).toBe("Note not found");

		yield* followLink("Back to notes");
		yield* settle();

		yield* outcomes([
			["page", heading, "Notes"],
			["notes", shownNotes, ["no notes yet"]],
		]);
	},
);

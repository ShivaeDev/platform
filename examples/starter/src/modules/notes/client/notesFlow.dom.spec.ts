import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { aliceAccount, notesApp, notesHostScreen, signedInAccount } from "#modules/notes/test-support/app.tsx";

notesApp.it(
	"signing in on screen stores a session for alice and opens her notes",
	[aliceAccount(), notesHostScreen()],
	function* ({ arrivesAt, heading, route, settle, shownNotes, signsIn, storedSessions }) {
		yield* settle();
		expect(yield* storedSessions).toEqual([]);

		yield* signsIn("correct-horse-battery-staple");
		yield* arrivesAt("/");

		yield* outcomes([
			["page", heading, "Notes"],
			["route", route, "/"],
			["notes", shownNotes, ["no notes yet"]],
			["stored sessions", () => storedSessions, [{ email: "alice@app.test" }]],
		]);
	},
	15_000,
);

notesApp.it(
	"a note alice adds on screen is stored for her account",
	[signedInAccount(), notesHostScreen("/")],
	function* ({ addsNote, draft, settle, shownNotes, storedNotes }) {
		yield* settle();
		expect(yield* storedNotes).toEqual([]);

		yield* addsNote("First note");

		yield* outcomes([
			["notes", shownNotes, ["First note"]],
			["draft", draft, ""],
			["stored notes", () => storedNotes, [{ email: "alice@app.test", title: "First note", version: 0 }]],
		]);
	},
);

notesApp.it(
	"saving an edited note on screen stores its trimmed title as the next version",
	[signedInAccount(), notesHostScreen("/")],
	function* ({ addsNote, click, draft, enter, heading, openListedNote, saveState, settle, storedNotes }) {
		yield* settle();
		yield* addsNote("First note");
		yield* openListedNote();
		yield* settle();
		expect(yield* heading()).toBe("Edit note");
		yield* enter("  Revised note  ");

		yield* click("Save note");
		yield* settle();

		yield* outcomes([
			["draft", draft, "Revised note"],
			["save state", saveState, "All changes saved"],
			["stored notes", () => storedNotes, [{ email: "alice@app.test", title: "Revised note", version: 1 }]],
		]);
	},
);

notesApp.it(
	"deleting a note on screen removes it from storage and returns to an empty list",
	[signedInAccount(), notesHostScreen("/")],
	function* ({ addsNote, click, openListedNote, route, settle, shownNotes, storedNotes }) {
		yield* settle();
		yield* addsNote("First note");
		yield* openListedNote();
		yield* settle();
		expect(yield* storedNotes).toEqual([{ email: "alice@app.test", title: "First note", version: 0 }]);

		yield* click("Delete note");
		yield* settle();

		yield* outcomes([
			["route", route, "/"],
			["notes", shownNotes, ["no notes yet"]],
			["stored notes", () => storedNotes, []],
		]);
	},
);

notesApp.it(
	"signing out on screen deletes alice's stored session and shows sign-in",
	[signedInAccount(), notesHostScreen("/")],
	function* ({ click, heading, route, settle, storedSessions }) {
		yield* settle();
		expect(yield* storedSessions).toEqual([{ email: "alice@app.test" }]);

		yield* click("Sign out");
		yield* settle();

		yield* outcomes([
			["page", heading, "Sign in"],
			["route", route, "/sign-in"],
			["stored sessions", () => storedSessions, []],
		]);
	},
);

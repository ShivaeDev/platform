import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { editingNote, noteRevisedElsewhere, screens } from "#modules/notes/test-support/screens.ts";

const CONFLICT = "This note changed. Refresh and review your draft before trying again.";

screens.it("opening a note reads it once for both the route and the editor", [editingNote()], function* ({ noteReads }) {
	expect(yield* noteReads()).toBe("one note read");
});

screens.it(
	"a live revision refreshes the cached note but keeps alice's unsaved draft",
	[editingNote()],
	function* ({ cachedTitle, draft, enter, reviseNote, saveState, settle }) {
		yield* enter("Keep my draft");
		expect(yield* cachedTitle()).toBe("First note");

		yield* reviseNote("Changed elsewhere");
		yield* settle();

		yield* outcomes([
			["cached title", cachedTitle, "Changed elsewhere"],
			["draft", draft, "Keep my draft"],
			["save state", saveState, "Unsaved changes"],
		]);
	},
);

screens.it(
	"saving over a newer version shows the conflict and keeps the draft",
	[editingNote(), noteRevisedElsewhere("Saved elsewhere")],
	function* ({ alert, click, draft, enter, settle }) {
		yield* enter("  My draft  ");

		yield* click("Save note");
		yield* settle();

		yield* outcomes([
			["alert", alert, CONFLICT],
			["draft", draft, "  My draft  "],
		]);
	},
);

screens.it(
	"after a conflict, Refresh keeps the draft and the next save stores it trimmed",
	[editingNote(), noteRevisedElsewhere("Saved elsewhere")],
	function* ({ alert, click, draft, enter, saveState, settle, settleQuery }) {
		yield* enter("  My draft  ");
		yield* click("Save note");
		yield* settle();
		expect(yield* alert()).toBe(CONFLICT);

		yield* click("Refresh");
		yield* settleQuery("get");
		yield* click("Save note");
		yield* settle();

		yield* outcomes([
			["draft", draft, "My draft"],
			["alert", alert, "no alert"],
			["save state", saveState, "All changes saved"],
		]);
	},
);

screens.it(
	"a title the server refuses while editing shows its reason and stays in the field",
	[editingNote()],
	function* ({ alert, click, draft, enter, settle }) {
		yield* enter("reserved");

		yield* click("Save note");
		yield* settle();

		yield* outcomes([
			["alert", alert, "Choose another title"],
			["draft", draft, "reserved"],
		]);
	},
);

screens.it(
	"deleting a note returns to the list, which no longer shows it",
	[editingNote()],
	function* ({ click, openListedNote, route, settle, shownNotes, visitNotes }) {
		yield* visitNotes();
		yield* settle();
		expect(yield* shownNotes()).toEqual(["First note"]);
		yield* openListedNote();
		yield* settle();

		yield* click("Delete note");
		yield* settle();

		yield* outcomes([
			["route", route, "/"],
			["notes", shownNotes, ["no notes yet"]],
		]);
	},
);

screens.it(
	"deleting a note that changed elsewhere shows the conflict and keeps the editor open",
	[editingNote(), noteRevisedElsewhere("Saved elsewhere")],
	function* ({ alert, click, draft, route, settle }) {
		yield* click("Delete note");
		yield* settle();

		yield* outcomes([
			["alert", alert, CONFLICT],
			["route", route, "/notes/1"],
			["draft", draft, "First note"],
		]);
	},
);

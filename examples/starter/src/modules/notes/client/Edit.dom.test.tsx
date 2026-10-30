import { expect } from "vitest";
import { eventually } from "@shivaedev/test-story/client/react.ts";
import { editingNote, noteRevisedElsewhere, screens } from "#modules/notes/test-support/screens.ts";

screens.it(
	"shares the typed detail route's query and retains an edit through a live refresh",
	[editingNote()],
	function* ({ closeScreen, consoleErrors, enter, reviseNote, cachedTitle, queryCount, watchHints, draft, screenText }) {
		expect(queryCount("get")).toBe(1);
		const hints = yield* watchHints();
		yield* enter("Keep my draft");
		yield* reviseNote("Changed elsewhere");
		expect(yield* hints.next).toMatchObject({ _tag: "Changed" });
		yield* eventually(() => expect(cachedTitle()).toBe("Changed elsewhere"));
		yield* eventually(() => expect(queryCount("get")).toBeGreaterThan(1));
		yield* eventually(() => expect(draft()).toBe("Keep my draft"));
		yield* eventually(() => expect(screenText()).toContain("Unsaved changes"));
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);

screens.it(
	"shows a stale edit conflict, keeps the input, then refreshes and saves the reviewed draft",
	[editingNote(), noteRevisedElsewhere("Saved elsewhere")],
	function* ({ closeScreen, consoleErrors, enter, click, alert, draft, queryCount, settleQuery, screenText }) {
		yield* enter("  My draft  ");
		yield* click("Save note");
		yield* eventually(() => expect(alert()).toContain("This note changed"));
		yield* eventually(() => expect(draft()).toBe("  My draft  "));
		yield* click("Refresh");
		yield* settleQuery("get");
		expect(queryCount("get")).toBe(2);
		yield* eventually(() => expect(draft()).toBe("  My draft  "));
		yield* click("Save note");
		yield* eventually(() => expect(draft()).toBe("My draft"));
		yield* eventually(() => expect(alert()).toBeUndefined());
		yield* eventually(() => expect(screenText()).toContain("All changes saved"));
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);

screens.it("retains a field rejection while editing", [editingNote()], function* ({ closeScreen, consoleErrors, enter, click, alert, draft }) {
	yield* enter("reserved");
	yield* click("Save note");
	yield* eventually(() => expect(alert()).toBe("Choose another title"));
	yield* eventually(() => expect(draft()).toBe("reserved"));
	yield* closeScreen();
	expect(consoleErrors()).toEqual([]);
});

screens.it(
	"deletes a note and returns to the refreshed list without it",
	[editingNote()],
	function* ({ closeScreen, consoleErrors, visitNotes, noteLink, openListedNote, draft, click, route, screenText, savedNote, queryCount }) {
		yield* visitNotes();
		yield* eventually(() => expect(noteLink()).toBe("First note"));
		yield* openListedNote();
		yield* eventually(() => expect(draft()).toBe("First note"));
		yield* click("Delete note");
		yield* eventually(() => expect(route()).toBe("/"));
		yield* eventually(() => expect(screenText()).toContain("No notes yet"));
		yield* eventually(() => expect(savedNote()).toBeNull());
		yield* eventually(() => expect(queryCount("list")).toBeGreaterThan(1));
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);

screens.it(
	"keeps the editor open when deletion conflicts with a newer version",
	[editingNote(), noteRevisedElsewhere("Saved elsewhere")],
	function* ({ closeScreen, consoleErrors, click, alert, route, draft }) {
		yield* click("Delete note");
		yield* eventually(() => expect(alert()).toContain("This note changed"));
		yield* eventually(() => expect(route()).toBe("/notes/1"));
		yield* eventually(() => expect(draft()).toBe("First note"));
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);

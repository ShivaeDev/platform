import { expect } from "vitest";
import { editingNote, noteRevisedElsewhere, screens } from "#modules/notes/test-support/screens.ts";

screens.it(
	"shares the typed detail route's query and retains an edit through a live refresh",
	[editingNote()],
	function* ({ settle, closeScreen, consoleErrors, enter, reviseNote, cachedTitle, queryCount, draft, screenText }) {
		expect(queryCount("get")).toBe(1);
		yield* enter("Keep my draft");
		yield* reviseNote("Changed elsewhere");
		yield* settle();
		expect(cachedTitle()).toBe("Changed elsewhere");
		expect(queryCount("get")).toBeGreaterThan(1);
		expect(draft()).toBe("Keep my draft");
		expect(screenText()).toContain("Unsaved changes");
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);

screens.it(
	"shows a stale edit conflict, keeps the input, then refreshes and saves the reviewed draft",
	[editingNote(), noteRevisedElsewhere("Saved elsewhere")],
	function* ({ settle, closeScreen, consoleErrors, enter, click, alert, draft, queryCount, settleQuery, screenText }) {
		yield* enter("  My draft  ");
		yield* click("Save note");
		yield* settle();
		expect(alert()).toContain("This note changed");
		expect(draft()).toBe("  My draft  ");
		yield* click("Refresh");
		yield* settleQuery("get");
		expect(queryCount("get")).toBe(2);
		yield* settle();
		expect(draft()).toBe("  My draft  ");
		yield* click("Save note");
		yield* settle();
		expect(draft()).toBe("My draft");
		expect(alert()).toBeUndefined();
		expect(screenText()).toContain("All changes saved");
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);

screens.it(
	"retains a field rejection while editing",
	[editingNote()],
	function* ({ settle, closeScreen, consoleErrors, enter, click, alert, draft }) {
		yield* enter("reserved");
		yield* click("Save note");
		yield* settle();
		expect(alert()).toBe("Choose another title");
		expect(draft()).toBe("reserved");
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);

screens.it(
	"deletes a note and returns to the refreshed list without it",
	[editingNote()],
	function* ({ settle, closeScreen, consoleErrors, visitNotes, noteLink, openListedNote, draft, click, route, screenText, savedNote, queryCount }) {
		yield* visitNotes();
		yield* settle();
		expect(noteLink()).toBe("First note");
		yield* openListedNote();
		yield* settle();
		expect(draft()).toBe("First note");
		yield* click("Delete note");
		yield* settle();
		expect(route()).toBe("/");
		expect(screenText()).toContain("No notes yet");
		expect(savedNote()).toBeNull();
		expect(queryCount("list")).toBeGreaterThan(1);
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);

screens.it(
	"keeps the editor open when deletion conflicts with a newer version",
	[editingNote(), noteRevisedElsewhere("Saved elsewhere")],
	function* ({ settle, closeScreen, consoleErrors, click, alert, route, draft }) {
		yield* click("Delete note");
		yield* settle();
		expect(alert()).toContain("This note changed");
		expect(route()).toBe("/notes/1");
		expect(draft()).toBe("First note");
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);

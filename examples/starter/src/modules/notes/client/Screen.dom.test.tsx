import { expect } from "vitest";
import { eventually } from "@shivaedev/test-story/client/react.ts";
import { heldNotesList, notesRoute, screens } from "#modules/notes/test-support/screens.ts";

screens.it(
	"shares the route query, validates the form, retains a rejected title and refreshes after creation",
	[notesRoute()],
	function* ({
		closeScreen,
		consoleErrors,
		screenText,
		submit,
		alert,
		enter,
		draft,
		noteLink,
		wordCountText,
		finishWordCount,
		watchHints,
		queryCount,
	}) {
		yield* eventually(() => expect(screenText()).toContain("No notes yet"));
		expect(queryCount("list")).toBe(1);
		yield* submit();
		yield* eventually(() => expect(alert()).toBe("Enter a title"));
		expect(queryCount("list")).toBe(1);
		yield* enter("reserved");
		yield* submit();
		yield* eventually(() => expect(alert()).toBe("Choose another title"));
		yield* eventually(() => expect(draft()).toBe("reserved"));
		yield* enter("First note");
		yield* submit();
		yield* eventually(() => expect(noteLink()).toBe("First note"));
		yield* eventually(() => expect(draft()).toBe(""));
		yield* eventually(() => expect(alert()).toBeUndefined());
		expect(queryCount("list")).toBe(2);
		yield* eventually(() => expect(wordCountText()).toContain("Counting words…"));
		const hints = yield* watchHints();
		yield* finishWordCount(2);
		expect(yield* hints.next).toMatchObject({ _tag: "Changed" });
		yield* eventually(() => expect(wordCountText()).toContain("2 words"));
		yield* eventually(() => expect(queryCount("list")).toBeGreaterThan(2));
		yield* finishWordCount(1);
		expect(yield* hints.next).toMatchObject({ _tag: "Changed" });
		yield* eventually(() => expect(wordCountText()).toContain("1 word"));
		expect(wordCountText()).not.toContain("1 words");
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);

screens.it(
	"shows loading before the first result and keeps the empty message during a refresh",
	[heldNotesList(), notesRoute()],
	function* ({
		closeScreen,
		consoleErrors,
		refreshDisabled,
		loadingMessage,
		screenText,
		releaseNotesList,
		holdNotesList,
		click,
		queryCount,
		screenContent,
	}) {
		yield* eventually(() => expect(loadingMessage()).toBe("Loading…"));
		yield* eventually(() => expect(screenText()).not.toContain("No notes yet"));
		const content = yield* screenContent();
		expect(content.querySelector("table")).toBeNull();
		expect(content.querySelector('section[aria-label="Add a note"] form')).toBeNull();
		yield* releaseNotesList();
		yield* eventually(() => expect(refreshDisabled()).toBe(false));
		yield* eventually(() => expect(screenText()).toContain("No notes yet"));
		expect(content.querySelector('section[aria-label="Add a note"] form')).not.toBeNull();
		yield* eventually(() => expect(loadingMessage()).toBe(undefined));
		expect(content.querySelector("table")).toBeNull();
		yield* eventually(() => expect(screenText()).not.toContain("No results."));
		yield* holdNotesList();
		yield* click("Refresh");
		yield* eventually(() => expect(queryCount("list")).toBe(2));
		yield* eventually(() => expect(refreshDisabled()).toBe(true));
		yield* eventually(() => expect(screenText()).toContain("No notes yet"));
		yield* eventually(() => expect(loadingMessage()).toBe(undefined));
		expect(content.querySelector("table")).toBeNull();
		yield* releaseNotesList();
		yield* eventually(() => expect(refreshDisabled()).toBe(false));
		yield* eventually(() => expect(screenText()).toContain("No notes yet"));
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);

screens.it(
	"keeps the listed note without a loading message during manual and live-hint refreshes",
	[notesRoute()],
	function* ({
		closeScreen,
		consoleErrors,
		screenText,
		enter,
		submit,
		noteLink,
		holdNotesList,
		click,
		queryCount,
		refreshDisabled,
		loadingMessage,
		releaseNotesList,
		finishWordCount,
		watchHints,
		wordCountText,
	}) {
		yield* eventually(() => expect(screenText()).toContain("No notes yet"));
		yield* enter("First note");
		yield* submit();
		yield* eventually(() => expect(noteLink()).toBe("First note"));
		yield* holdNotesList();
		yield* click("Refresh");
		yield* eventually(() => expect(queryCount("list")).toBe(3));
		yield* eventually(() => expect(refreshDisabled()).toBe(true));
		yield* eventually(() => expect(noteLink()).toBe("First note"));
		yield* eventually(() => expect(loadingMessage()).toBe(undefined));
		yield* releaseNotesList();
		yield* eventually(() => expect(refreshDisabled()).toBe(false));
		yield* eventually(() => expect(wordCountText()).toContain("Counting words…"));
		yield* holdNotesList();
		const hints = yield* watchHints();
		yield* finishWordCount(2);
		expect(yield* hints.next).toMatchObject({ _tag: "Changed" });
		yield* eventually(() => expect(queryCount("list")).toBeGreaterThan(3));
		yield* eventually(() => expect(refreshDisabled()).toBe(true));
		yield* eventually(() => expect(noteLink()).toBe("First note"));
		yield* eventually(() => expect(wordCountText()).toContain("Counting words…"));
		yield* eventually(() => expect(loadingMessage()).toBe(undefined));
		yield* releaseNotesList();
		yield* eventually(() => expect(refreshDisabled()).toBe(false));
		yield* eventually(() => expect(wordCountText()).toContain("2 words"));
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);

screens.it("refuses a whitespace-only title in the form before submit", [notesRoute()], function* ({ enter, alert, queryCount, draft }) {
	yield* enter("   ");

	expect(alert()).toBe("Enter a title");
	expect(draft()).toBe("   ");
	expect(queryCount("list")).toBe(1);
});

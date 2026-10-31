import { expect } from "vitest";
import { heldNotesList, notesRoute, screens } from "#modules/notes/test-support/screens.ts";

screens.it(
	"shares the route query, validates the form, retains a rejected title and refreshes after creation",
	[notesRoute()],
	function* ({
		settle,
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
		reads,
		queryCount,
	}) {
		yield* settle();
		expect(screenText()).toContain("No notes yet");
		expect(
			reads()
				.filter(({ tag }) => tag === "notes.list")
				.map(({ tag }) => tag),
		).toEqual(["notes.list"]);
		yield* submit();
		yield* settle();
		expect(alert()).toBe("Enter a title");
		expect(
			reads()
				.filter(({ tag }) => tag === "notes.list")
				.map(({ tag }) => tag),
		).toEqual(["notes.list"]);
		yield* enter("reserved");
		yield* submit();
		yield* settle();
		expect(alert()).toBe("Choose another title");
		expect(draft()).toBe("reserved");
		yield* enter("First note");
		yield* submit();
		yield* settle();
		expect(noteLink()).toBe("First note");
		expect(draft()).toBe("");
		expect(alert()).toBeUndefined();
		expect(
			reads()
				.filter(({ tag }) => tag === "notes.list")
				.map(({ tag }) => tag),
		).toEqual(["notes.list", "notes.list"]);
		expect(wordCountText()).toContain("Counting words…");
		yield* finishWordCount(2);
		yield* settle();
		expect(wordCountText()).toContain("2 words");
		expect(queryCount("list")).toBeGreaterThan(2);
		yield* finishWordCount(1);
		yield* settle();
		expect(wordCountText()).toContain("1 word");
		expect(wordCountText()).not.toContain("1 words");
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);

screens.it(
	"shows loading before the first result and keeps the empty message during a refresh",
	[heldNotesList(), notesRoute()],
	function* ({
		settle,
		waitForList,
		closeScreen,
		consoleErrors,
		refreshDisabled,
		loadingMessage,
		screenText,
		releaseNotesList,
		holdNotesList,
		click,
		reads,
		screenContent,
	}) {
		expect(loadingMessage()).toBe("Loading…");
		expect(screenText()).not.toContain("No notes yet");
		const content = yield* screenContent();
		expect(content.querySelector("table")).toBeNull();
		expect(content.querySelector('section[aria-label="Add a note"] form')).toBeNull();
		yield* releaseNotesList();
		yield* settle();
		expect(refreshDisabled()).toBe(false);
		expect(screenText()).toContain("No notes yet");
		expect(content.querySelector('section[aria-label="Add a note"] form')).not.toBeNull();
		expect(loadingMessage()).toBe(undefined);
		expect(content.querySelector("table")).toBeNull();
		expect(screenText()).not.toContain("No results.");
		yield* holdNotesList();
		yield* click("Refresh");
		yield* waitForList();
		expect(
			reads()
				.filter(({ tag }) => tag === "notes.list")
				.map(({ tag }) => tag),
		).toEqual(["notes.list", "notes.list"]);
		expect(refreshDisabled()).toBe(true);
		expect(screenText()).toContain("No notes yet");
		expect(loadingMessage()).toBe(undefined);
		expect(content.querySelector("table")).toBeNull();
		yield* releaseNotesList();
		yield* settle();
		expect(refreshDisabled()).toBe(false);
		expect(screenText()).toContain("No notes yet");
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);

screens.it(
	"keeps the listed note without a loading message during manual and live-hint refreshes",
	[notesRoute()],
	function* ({
		settle,
		waitForList,
		closeScreen,
		consoleErrors,
		screenText,
		enter,
		submit,
		noteLink,
		holdNotesList,
		click,
		reads,
		queryCount,
		refreshDisabled,
		loadingMessage,
		releaseNotesList,
		finishWordCount,
		wordCountText,
	}) {
		yield* settle();
		expect(screenText()).toContain("No notes yet");
		yield* enter("First note");
		yield* submit();
		yield* settle();
		expect(noteLink()).toBe("First note");
		yield* holdNotesList();
		yield* click("Refresh");
		yield* waitForList();
		expect(
			reads()
				.filter(({ tag }) => tag === "notes.list")
				.map(({ tag }) => tag),
		).toEqual(["notes.list", "notes.list", "notes.list"]);
		expect(refreshDisabled()).toBe(true);
		expect(noteLink()).toBe("First note");
		expect(loadingMessage()).toBe(undefined);
		yield* releaseNotesList();
		yield* settle();
		expect(refreshDisabled()).toBe(false);
		expect(wordCountText()).toContain("Counting words…");
		yield* holdNotesList();
		yield* finishWordCount(2);
		yield* waitForList();
		expect(queryCount("list")).toBeGreaterThan(3);
		expect(refreshDisabled()).toBe(true);
		expect(noteLink()).toBe("First note");
		expect(wordCountText()).toContain("Counting words…");
		expect(loadingMessage()).toBe(undefined);
		yield* releaseNotesList();
		yield* settle();
		expect(refreshDisabled()).toBe(false);
		expect(wordCountText()).toContain("2 words");
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);

screens.it("refuses a whitespace-only title in the form before submit", [notesRoute()], function* ({ enter, alert, reads, draft }) {
	yield* enter("   ");

	expect(alert()).toBe("Enter a title");
	expect(draft()).toBe("   ");
	expect(
		reads()
			.filter(({ tag }) => tag === "notes.list")
			.map(({ tag }) => tag),
	).toEqual(["notes.list"]);
});

import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/testing.ts";
import { heldNotesList, notesRoute, notesScreen, screens } from "#test-support/screens.ts";

screens.it(
	"shares the route query, validates the form, retains a rejected title and refreshes after creation",
	[notesRoute()],
	function* ({
		closeScreen,
		consoleErrors,
		screenText,
		noteCalls,
		submit,
		alert,
		enter,
		draft,
		noteLink,
		wordCountText,
		finishWordCount,
		queryCount,
	}) {
		yield* Effect.promise(() => eventually(() => expect(screenText()).toContain("No notes yet")));
		yield* Effect.promise(() => eventually(() => expect(noteCalls()).toEqual(["list"])));
		yield* submit();
		yield* Effect.promise(() => eventually(() => expect(alert()).toBe("Required")));
		yield* Effect.promise(() => eventually(() => expect(noteCalls()).toEqual(["list"])));
		yield* enter("reserved");
		yield* submit();
		yield* Effect.promise(() => eventually(() => expect(alert()).toBe("Choose another title")));
		yield* Effect.promise(() => eventually(() => expect(draft()).toBe("reserved")));
		yield* enter("First note");
		yield* submit();
		yield* Effect.promise(() => eventually(() => expect(noteLink()).toBe("First note")));
		yield* Effect.promise(() => eventually(() => expect(draft()).toBe("")));
		yield* Effect.promise(() => eventually(() => expect(alert()).toBeUndefined()));
		yield* Effect.promise(() => eventually(() => expect(noteCalls()).toEqual(["list", "create", "list"])));
		yield* Effect.promise(() => eventually(() => expect(wordCountText()).toContain("Counting words…")));
		yield* finishWordCount(2);
		yield* Effect.promise(() => eventually(() => expect(wordCountText()).toContain("2 words")));
		yield* Effect.promise(() => eventually(() => expect(queryCount("list")).toBeGreaterThan(2)));
		yield* finishWordCount(1);
		yield* Effect.promise(() => eventually(() => expect(wordCountText()).toContain("1 word")));
		expect(wordCountText()).not.toContain("1 words");
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);

screens.it(
	"shows loading before the first result and keeps the empty message during a refresh",
	[heldNotesList(), notesScreen()],
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
		yield* Effect.promise(() => eventually(() => expect(refreshDisabled()).toBe(true)));
		yield* Effect.promise(() => eventually(() => expect(loadingMessage()).toBe("Loading notes…")));
		yield* Effect.promise(() => eventually(() => expect(screenText()).not.toContain("No notes yet")));
		const content = yield* screenContent();
		expect(content.querySelector("table")).toBeNull();
		expect(content.querySelector('section[aria-label="Add a note"] form')).not.toBeNull();
		yield* releaseNotesList();
		yield* Effect.promise(() => eventually(() => expect(refreshDisabled()).toBe(false)));
		yield* Effect.promise(() => eventually(() => expect(screenText()).toContain("No notes yet")));
		yield* Effect.promise(() => eventually(() => expect(loadingMessage()).toBe(undefined)));
		expect(content.querySelector("table")).toBeNull();
		yield* Effect.promise(() => eventually(() => expect(screenText()).not.toContain("No results.")));
		yield* holdNotesList();
		yield* click("Refresh");
		yield* Effect.promise(() => eventually(() => expect(queryCount("list")).toBe(2)));
		yield* Effect.promise(() => eventually(() => expect(refreshDisabled()).toBe(true)));
		yield* Effect.promise(() => eventually(() => expect(screenText()).toContain("No notes yet")));
		yield* Effect.promise(() => eventually(() => expect(loadingMessage()).toBe(undefined)));
		expect(content.querySelector("table")).toBeNull();
		yield* releaseNotesList();
		yield* Effect.promise(() => eventually(() => expect(refreshDisabled()).toBe(false)));
		yield* Effect.promise(() => eventually(() => expect(screenText()).toContain("No notes yet")));
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
		wordCountText,
	}) {
		yield* Effect.promise(() => eventually(() => expect(screenText()).toContain("No notes yet")));
		yield* enter("First note");
		yield* submit();
		yield* Effect.promise(() => eventually(() => expect(noteLink()).toBe("First note")));
		yield* holdNotesList();
		yield* click("Refresh");
		yield* Effect.promise(() => eventually(() => expect(queryCount("list")).toBe(3)));
		yield* Effect.promise(() => eventually(() => expect(refreshDisabled()).toBe(true)));
		yield* Effect.promise(() => eventually(() => expect(noteLink()).toBe("First note")));
		yield* Effect.promise(() => eventually(() => expect(loadingMessage()).toBe(undefined)));
		yield* releaseNotesList();
		yield* Effect.promise(() => eventually(() => expect(refreshDisabled()).toBe(false)));
		yield* Effect.promise(() => eventually(() => expect(wordCountText()).toContain("Counting words…")));
		yield* holdNotesList();
		yield* finishWordCount(2);
		yield* Effect.promise(() => eventually(() => expect(queryCount("list")).toBeGreaterThan(3)));
		yield* Effect.promise(() => eventually(() => expect(refreshDisabled()).toBe(true)));
		yield* Effect.promise(() => eventually(() => expect(noteLink()).toBe("First note")));
		yield* Effect.promise(() => eventually(() => expect(wordCountText()).toContain("Counting words…")));
		yield* Effect.promise(() => eventually(() => expect(loadingMessage()).toBe(undefined)));
		yield* releaseNotesList();
		yield* Effect.promise(() => eventually(() => expect(refreshDisabled()).toBe(false)));
		yield* Effect.promise(() => eventually(() => expect(wordCountText()).toContain("2 words")));
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);

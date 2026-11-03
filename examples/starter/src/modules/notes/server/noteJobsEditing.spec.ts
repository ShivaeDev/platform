import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { app, signedIn } from "#modules/notes/test-support/application.ts";
import { refusal } from "#test-support/answers.ts";

app.it(
	"the worker counts the words of alice's edited title",
	[signedIn("alice")],
	function* ({ notesOf, workerCountsQueuedNotes }) {
		const note = yield* notesOf("alice").create("Old title");
		const edited = yield* notesOf("alice").edit(note, "Three new words");
		expect(edited.wordCount).toBeNull();

		yield* workerCountsQueuedNotes();

		expect(yield* notesOf("alice").open(note)).toEqual({ ...edited, version: 2, wordCount: 3 });
	},
	15_000,
);

app.it(
	"alice's edit of a counted note clears its word count until the worker counts again",
	[signedIn("alice")],
	function* ({ notesOf, workerCountsQueuedNotes }) {
		const note = yield* notesOf("alice").create("Three new words");
		yield* workerCountsQueuedNotes();
		const counted = yield* notesOf("alice").open(note);
		expect(counted).toEqual({ ...note, version: 1, wordCount: 3 });

		const edited = yield* notesOf("alice").edit(counted, "Four brand new words");

		expect(edited).toEqual({ ...counted, title: "Four brand new words", version: 2, wordCount: null });
	},
	15_000,
);

app.it(
	"alice's edit from before the worker's count is refused as a conflict and keeps the counted note",
	[signedIn("alice")],
	function* ({ notesOf, workerCountsQueuedNotes }) {
		const note = yield* notesOf("alice").create("Three new words");
		yield* workerCountsQueuedNotes();

		const stale = yield* refusal(notesOf("alice").edit(note, "Before counting"));

		yield* outcomes([
			["the stale edit", () => Effect.succeed(stale), "conflict: This note changed. Refresh and review your draft before trying again."],
			["alice's note", () => notesOf("alice").open(note), { ...note, version: 1, wordCount: 3 }],
		]);
	},
	15_000,
);

app.it(
	"after alice deletes a queued note, the worker counts her remaining note",
	[signedIn("alice")],
	function* ({ notesOf, workerCountsQueuedNotes }) {
		const note = yield* notesOf("alice").create("Deleted before counting");
		yield* notesOf("alice").delete(note);
		const remaining = yield* notesOf("alice").create("Count these words");
		expect(yield* notesOf("alice").list()).toEqual([remaining]);

		yield* workerCountsQueuedNotes();

		expect(yield* notesOf("alice").list()).toEqual([{ ...remaining, version: 1, wordCount: 3 }]);
	},
	15_000,
);

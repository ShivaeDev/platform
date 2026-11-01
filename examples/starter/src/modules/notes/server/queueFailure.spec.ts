import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { app, noteCommitsFail, signedIn } from "#modules/notes/test-support/application.ts";
import { answer } from "#test-support/answers.ts";

app.it(
	"when the queue refuses the word-count job, alice's new note is still saved and the failure is logged",
	[signedIn("alice")],
	function* ({ notesOf, queueRefusesNextWordCount, recordedEnqueueFailures }) {
		yield* queueRefusesNextWordCount();

		const note = yield* notesOf("alice").create("Still saved");

		yield* outcomes([
			["alice's notes", () => notesOf("alice").list(), [note]],
			["logged enqueue failures", () => recordedEnqueueFailures(), [{ noteId: note.id, queue: "count-note-words" }]],
		]);
	},
);

app.it(
	"when the queue refuses the word-count job, alice's edit is still saved and the failure is logged",
	[signedIn("alice")],
	function* ({ notesOf, queueRefusesNextWordCount, recordedEnqueueFailures }) {
		const note = yield* notesOf("alice").create("First title");
		yield* queueRefusesNextWordCount();

		yield* notesOf("alice").edit(note, "Still edited");

		yield* outcomes([
			["alice's note", () => notesOf("alice").open(note), { ...note, title: "Still edited", version: 1, wordCount: null }],
			["logged enqueue failures", () => recordedEnqueueFailures(), [{ noteId: note.id, queue: "count-note-words" }]],
		]);
	},
);

app.it(
	"a note PostgreSQL rejects at commit answers internal server error and is not saved",
	[signedIn("alice"), noteCommitsFail()],
	function* ({ notesOf }) {
		const created = yield* answer(notesOf("alice").create("Not committed"));

		yield* outcomes([
			["alice's create", () => Effect.succeed(created), "internal server error"],
			["alice's notes", () => notesOf("alice").list(), []],
		]);
	},
);

app.it(
	"a note PostgreSQL rejects at commit queues no word-count job, while the next committed note queues one",
	[signedIn("alice"), noteCommitsFail()],
	function* ({ noteCommitsRecover, notesOf, wordCountJobs }) {
		yield* answer(notesOf("alice").create("Not committed"));

		yield* noteCommitsRecover();
		const control = yield* notesOf("alice").create("Committed control");
		expect(yield* wordCountJobs()).toEqual([{ noteId: control.id, state: "created" }]);
	},
);

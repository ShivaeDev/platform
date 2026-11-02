import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { app, noteCommitsFail, signedIn } from "#modules/notes/test-support/application.ts";
import type { NotesRequests } from "#modules/notes/test-support/requests.ts";
import { answer } from "#test-support/answers.ts";

const writes: ReadonlyArray<readonly [string, (notes: NotesRequests) => Effect.Effect<unknown, unknown>]> = [
	["create", (notes) => notes.create("Not saved")],
	["import", (notes) => notes.import(7)],
];

for (const [write, send] of writes) {
	app.it(
		`when enqueue fails, alice's ${write} answers internal server error and saves no note`,
		[signedIn("alice")],
		function* ({ notesOf, queueRefusesNextWordCount }) {
			yield* queueRefusesNextWordCount();

			const created = yield* answer(send(notesOf("alice")));

			yield* outcomes([
				["alice's write", () => Effect.succeed(created), "internal server error"],
				["alice's notes", () => notesOf("alice").list(), []],
			]);
		},
		{ clock: "live" },
	);
}

app.it(
	"when enqueue fails, alice's edit answers internal server error and keeps the counted note unchanged",
	[signedIn("alice")],
	function* ({ notesOf, queueRefusesNextWordCount, workerCountsQueuedNotes, workerStops }) {
		const note = yield* notesOf("alice").create("First title");
		yield* workerCountsQueuedNotes();
		yield* workerStops();
		const counted = yield* notesOf("alice").open(note);
		expect(counted).toEqual({ ...note, version: 1, wordCount: 2 });
		yield* queueRefusesNextWordCount();

		const edited = yield* answer(notesOf("alice").edit(counted, "Not edited"));

		yield* outcomes([
			["alice's edit", () => Effect.succeed(edited), "internal server error"],
			["alice's note", () => notesOf("alice").open(note), counted],
		]);
	},
	{ clock: "live" },
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
	{ clock: "live" },
);

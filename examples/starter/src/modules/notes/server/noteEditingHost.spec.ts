import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import type { Note } from "#modules/notes/notes.ts";
import { app, signedIn } from "#modules/notes/test-support/application.ts";
import type { NotesRequests } from "#modules/notes/test-support/requests.ts";
import { answer, refusal } from "#test-support/answers.ts";

const CONFLICT = "conflict: This note changed. Refresh and review your draft before trying again.";

app.it("alice's edit saves the new title at the next version", [signedIn("alice")], function* ({ notesOf }) {
	const note = yield* notesOf("alice").create("Original");
	expect(note.version).toBe(0);

	const edited = yield* notesOf("alice").edit(note, "Saved note");

	yield* outcomes([
		["the edit", () => Effect.succeed(edited), { ...note, title: "Saved note", version: 1 }],
		["alice's note", () => notesOf("alice").open(note), { ...note, title: "Saved note", version: 1 }],
	]);
});

const staleWrites: ReadonlyArray<readonly [string, (notes: NotesRequests, note: Note) => Effect.Effect<unknown, unknown>]> = [
	["edit", (notes, note) => notes.edit(note, "Stale draft")],
	["delete", (notes, note) => notes.delete(note)],
];

for (const [write, send] of staleWrites) {
	app.it(
		`alice's ${write} from before her last edit is refused as a conflict and keeps the saved note`,
		[signedIn("alice")],
		function* ({ notesOf }) {
			const original = yield* notesOf("alice").create("Original");
			const saved = yield* notesOf("alice").edit(original, "Saved note");

			const stale = yield* refusal(send(notesOf("alice"), original));

			yield* outcomes([
				[`the stale ${write}`, () => Effect.succeed(stale), CONFLICT],
				["alice's note", () => notesOf("alice").open(saved), saved],
			]);
		},
	);
}

app.it(
	"after alice deletes her note it leaves her list, and opening, editing or deleting it answers not found",
	[signedIn("alice")],
	function* ({ notesOf }) {
		const note = yield* notesOf("alice").create("Short-lived");
		expect(yield* notesOf("alice").list()).toEqual([note]);

		yield* notesOf("alice").delete(note);

		yield* outcomes([
			["alice's notes", () => notesOf("alice").list(), []],
			["opening it", () => refusal(notesOf("alice").open(note)), "not found: Note not found"],
			["editing it", () => refusal(notesOf("alice").edit(note, "Missing")), "not found: Note not found"],
			["deleting it", () => refusal(notesOf("alice").delete(note)), "not found: Note not found"],
		]);
	},
);

const othersWrites: ReadonlyArray<readonly [string, (notes: NotesRequests, note: Note) => Effect.Effect<unknown, unknown>]> = [
	["edit", (notes, note) => notes.edit(note, "Another account")],
	["delete", (notes, note) => notes.delete(note)],
];

for (const [write, send] of othersWrites) {
	app.it(`bob's ${write} of alice's note answers not found and leaves it unchanged`, [signedIn("alice"), signedIn("bob")], function* ({ notesOf }) {
		const note = yield* notesOf("alice").create("Alice's note");

		const bobs = yield* refusal(send(notesOf("bob"), note));

		yield* outcomes([
			[`bob's ${write}`, () => Effect.succeed(bobs), "not found: Note not found"],
			["alice's note", () => notesOf("alice").open(note), note],
		]);
	});
}

const visitorRequests: ReadonlyArray<readonly [string, (notes: NotesRequests, note: Note) => Effect.Effect<unknown, unknown>]> = [
	["opening", (notes, note) => notes.open(note)],
	["editing", (notes, note) => notes.edit(note, "Another account")],
	["deleting", (notes, note) => notes.delete(note)],
];

for (const [request, send] of visitorRequests) {
	app.it(`a signed-out visitor ${request} alice's note is told to sign in`, [signedIn("alice")], function* ({ notesOf, visitorNotes }) {
		const note = yield* notesOf("alice").create("Alice's note");
		const visitor = yield* visitorNotes();

		const answered = yield* answer(send(visitor, note));

		yield* outcomes([
			[`the visitor ${request} it`, () => Effect.succeed(answered), "sign in required"],
			["alice's note", () => notesOf("alice").open(note), note],
		]);
	});
}

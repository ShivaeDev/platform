import type { Effect } from "effect";
import { expect } from "vitest";
import { app, legacyNote, signedIn } from "#modules/notes/test-support/application.ts";
import type { NotesRequests } from "#modules/notes/test-support/requests.ts";
import { answer } from "#test-support/answers.ts";

app.it("alice creates a note and finds it in her list", [signedIn("alice")], function* ({ notesOf }) {
	expect(yield* notesOf("alice").list()).toEqual([]);

	const note = yield* notesOf("alice").create("First note");

	expect(yield* notesOf("alice").list()).toEqual([{ ...note, title: "First note" }]);
});

const visitorRequests: ReadonlyArray<readonly [string, (notes: NotesRequests) => Effect.Effect<unknown, unknown>]> = [
	["listing notes", (notes) => notes.list()],
	["creating a note", (notes) => notes.create("Anonymous note")],
];

for (const [request, send] of visitorRequests) {
	app.it(`a signed-out visitor ${request} is told to sign in`, [], function* ({ visitorNotes }) {
		const visitor = yield* visitorNotes();

		const answered = yield* answer(send(visitor));

		expect(answered).toBe("sign in required");
	});
}

app.it(
	"alice's list holds her own note but not the unowned note from before notes had owners",
	[signedIn("alice"), legacyNote("Legacy note")],
	function* ({ notesOf }) {
		const note = yield* notesOf("alice").create("Alice's note");

		const listed = yield* notesOf("alice").list();

		expect(listed).toEqual([note]);
	},
);

app.it("after alice signs out, her old session is told to sign in", [signedIn("alice")], function* ({ notesOf, signsOut }) {
	expect(yield* answer(notesOf("alice").list())).toEqual([]);

	yield* signsOut("alice");

	expect(yield* answer(notesOf("alice").create("Revoked note"))).toBe("sign in required");
});

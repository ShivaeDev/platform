import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { app, signedIn } from "#modules/notes/test-support/application.ts";
import { refusal } from "#test-support/answers.ts";

app.it(
	"bob opening alice's note gets the same not-found answer as opening a note that does not exist",
	[signedIn("alice"), signedIn("bob")],
	function* ({ notesOf }) {
		const note = yield* notesOf("alice").create("Alice's private note");

		const opened = yield* refusal(notesOf("bob").open(note));

		yield* outcomes([
			["bob opening alice's note", () => Effect.succeed(opened), "not found: Note not found"],
			["bob opening a missing note", () => refusal(notesOf("bob").open({ id: -1 })), "not found: Note not found"],
		]);
	},
);

app.it(
	"bob's request for change hints on alice's note is refused as not found",
	[signedIn("alice"), signedIn("bob")],
	function* ({ listensForChangesTo, notesOf }) {
		const note = yield* notesOf("alice").create("Alice's private note");

		expect(yield* listensForChangesTo("bob", note)).toBe("not found: Note not found");
	},
);

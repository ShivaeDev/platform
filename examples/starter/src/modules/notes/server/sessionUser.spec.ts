import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { app, signedIn } from "#modules/notes/test-support/application.ts";

app.it("alice and bob create notes at the same time and each finds only their own", [signedIn("alice"), signedIn("bob")], function* ({ notesOf }) {
	const [aliceNote, bobNote] = yield* Effect.all([notesOf("alice").create("Alice's note"), notesOf("bob").create("Bob's note")], {
		concurrency: "unbounded",
	});

	yield* outcomes([
		["alice's notes", () => notesOf("alice").list(), [aliceNote]],
		["bob's notes", () => notesOf("bob").list(), [bobNote]],
	]);
});

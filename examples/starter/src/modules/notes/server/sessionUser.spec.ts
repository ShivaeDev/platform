import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { app, signedIn } from "#modules/notes/test-support/application.ts";

app.it("keeps concurrent note ownership separate for alice and bob", [signedIn(), signedIn("bob")], function* ({ actor }) {
	const alice = actor().notes;
	const bob = actor("bob").notes;

	const [aliceNote, bobNote] = yield* Effect.all([alice.create({ title: "Alice's note" }), bob.create({ title: "Bob's note" })], {
		concurrency: "unbounded",
	});

	yield* outcomes({ "alice's notes": [alice.list(), [aliceNote]], "bob's notes": [bob.list(), [bobNote]] });
});

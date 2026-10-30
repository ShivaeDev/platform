import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { notes } from "#modules/notes/notes.ts";
import { app, signedIn } from "#modules/notes/test-support/application.ts";

app.it(
	"refreshes alice's open list without sending her write to bob's open list",
	[signedIn(), signedIn("bob")],
	function* ({ actor, liveNotes, listHints }) {
		const alice = yield* liveNotes();
		const bob = yield* liveNotes("bob");
		const bobHints = yield* listHints("bob");
		yield* outcomes({
			"alice's initial list": [alice.nextNotes(), []],
			"bob's initial list": [bob.nextNotes(), []],
		});

		const aliceNote = yield* actor().notes.create({ title: "Alice's private note" });

		yield* outcomes({
			"alice's live list": [alice.nextNotes(), [aliceNote]],
			"bob's unchanged list": [Effect.sync(bob.notes), []],
		});

		const bobNote = yield* actor("bob").notes.create({ title: "Bob's delivery checkpoint" });

		yield* outcomes({
			"bob's live list": [bob.nextNotes(), [bobNote]],
			"bob's next socket delivery": [bobHints.nextDelivery(), { keys: [notes.bucket.userId(actor("bob").userId)], kind: "change" }],
		});
	},
	15_000,
);

app.it("refreshes an open note detail after its title changes", [signedIn()], function* ({ actor, liveNote }) {
	const client = actor().notes;
	const note = yield* client.create({ title: "Original title" });
	const live = yield* liveNote(note.id);
	expect(yield* live.nextNote()).toEqual(note);

	const edited = yield* client.update({ ...note, title: "Changed title" });

	expect(yield* live.nextNote()).toEqual(edited);
});

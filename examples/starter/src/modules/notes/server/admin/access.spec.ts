import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { adminAccount, adminHost } from "#modules/notes/test-support/admin/host.ts";

adminHost.it(
	"an admin's statistics and word-count queue count every owner's new notes",
	[adminAccount("alice"), adminAccount("bob"), adminAccount("operator", "admin")],
	function* ({ createsNote, noteStatistics, wordCountQueue }) {
		expect(yield* noteStatistics("operator")).toEqual({ notes: 0, pending: 0, words: 0 });

		yield* createsNote("alice", "Alice's note");
		yield* createsNote("bob", "Bob's note");

		yield* outcomes([
			["notes statistics", () => noteStatistics("operator"), { notes: 2, pending: 2, words: 0 }],
			["word-count queue", () => wordCountQueue("operator"), { queued: 2, total: 2 }],
		]);
	},
);

adminHost.it(
	"after the worker counts the queued notes, an admin's statistics show their words",
	[adminAccount("alice"), adminAccount("operator", "admin")],
	function* ({ createsNote, noteStatistics, workerCountsQueuedNotes }) {
		yield* createsNote("alice", "Alice's first note");
		yield* createsNote("alice", "Second");
		expect(yield* noteStatistics("operator")).toEqual({ notes: 2, pending: 2, words: 0 });

		yield* workerCountsQueuedNotes();

		expect(yield* noteStatistics("operator")).toEqual({ notes: 2, pending: 0, words: 4 });
	},
	15_000,
);

adminHost.it("an admin's job health lists the app's word-count queue", [adminAccount("operator", "admin")], function* ({ jobQueues }) {
	const queues = yield* jobQueues("operator");

	expect(queues).toEqual(["count-note-words"]);
});

const refusedReaders = [
	["reader", [adminAccount("reader")], "permission denied"],
	["visitor", [], "sign in required"],
] as const;

for (const [name, accounts, refused] of refusedReaders) {
	adminHost.it(`the notes statistics and job health answer ${name} with ${refused}`, accounts, function* ({ jobQueues, noteStatistics }) {
		const statistics = yield* noteStatistics(name);

		yield* outcomes([
			["notes statistics", () => Effect.succeed(statistics), refused],
			["job health", () => jobQueues(name), refused],
		]);
	});
}

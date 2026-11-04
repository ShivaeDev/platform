import { expect } from "vitest";
import { processLocks } from "#test/processLocks.ts";

processLocks.it("a story observes the named lock held by a process it launched", [], function* ({ launch, takeLock, heldBy }) {
	yield* launch("alice", "notes:migrate");
	yield* launch("bob", "notes:word-count");
	yield* takeLock("alice");
	yield* heldBy("notes:migrate");

	yield* takeLock("bob");

	expect(yield* heldBy("notes:word-count")).toEqual(["bob"]);
});

processLocks.it("a story observes another process blocked behind the lock holder", [], function* ({ launch, takeLock, heldBy, blockedBehind }) {
	yield* launch("alice", "notes:migrate");
	yield* takeLock("alice");
	yield* heldBy("notes:migrate");
	yield* launch("bob", "notes:migrate");

	yield* takeLock("bob");

	expect(yield* blockedBehind("alice")).toEqual(["bob"]);
});

for (const [key, actor] of [
	["another:lock", undefined],
	["notes:migrate", "bob"],
] as const) {
	processLocks.it(
		`a held lock does not satisfy a wait for ${actor === undefined ? "another key" : "another process"}`,
		[],
		function* ({ launch, takeLock, heldBy, missingLock }) {
			yield* launch("alice", "notes:migrate");
			yield* takeLock("alice");
			yield* heldBy("notes:migrate");

			const outcome = yield* missingLock(key, actor);

			expect(outcome).toBe("lock was not held");
		},
	);
}

processLocks.it(
	"a queued lock request is not reported as held by its process",
	[],
	function* ({ launch, takeLock, heldBy, blockedBehind, missingLock }) {
		yield* launch("alice", "notes:migrate");
		yield* takeLock("alice");
		yield* heldBy("notes:migrate");
		yield* launch("bob", "notes:migrate");
		yield* takeLock("bob");
		yield* blockedBehind("alice");

		const outcome = yield* missingLock("notes:migrate", "bob");

		expect(outcome).toBe("lock was not held");
	},
);

processLocks.it("a named lock held in another database does not satisfy the story's wait", [], function* ({ launch, takeLock, heldBy, missingLock }) {
	yield* launch("alice", "notes:migrate", "another database");
	yield* takeLock("alice");
	yield* heldBy("notes:migrate", "alice", "another database");

	const outcome = yield* missingLock("notes:migrate");

	expect(outcome).toBe("lock was not held");
});

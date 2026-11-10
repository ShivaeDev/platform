import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { moduleStory, noteStored, storeFails } from "#test/moduleStory.ts";

moduleStory.it("alice's create answers the note it stored, and her list then shows it", [], function* ({ create, list }) {
	const created = yield* create("alice", "Groceries");

	yield* outcomes([
		["create answer", () => Effect.succeed(created), "note 1: Groceries"],
		["alice's list", () => list("alice"), "note 1: Groceries"],
	]);
});

moduleStory.it("each served operation runs in a span named after its module and operation", [], function* ({ create, list, operationSpans }) {
	yield* create("alice", "Groceries");
	yield* list("alice");

	expect(yield* operationSpans()).toEqual(["ModuleNotes.create", "ModuleNotes.list"]);
});

moduleStory.it("a declared rejection raised in run reaches the client as that rejection", [noteStored("alice", "Groceries")], function* ({ create }) {
	expect(yield* create("alice", "Groceries")).toBe("failed with title taken: You already have a note with that title");
});

moduleStory.it("an undeclared retryable store failure answers ServiceUnavailable", [storeFails("unavailable")], function* ({ create }) {
	expect(yield* create("alice", "Groceries")).toBe("failed with service unavailable");
});

moduleStory.it("a defect in the store answers InternalServerError", [storeFails("defect")], function* ({ create }) {
	expect(yield* create("alice", "Groceries")).toBe("failed with internal server error: Internal server error");
});

moduleStory.it("a query without a readPolicy denies an anonymous viewer and answers alice", [noteStored("alice", "Groceries")], function* ({ list }) {
	yield* outcomes([
		["anonymous viewer", () => list("anonymous"), "failed with read denied"],
		["alice", () => list("alice"), "note 1: Groceries"],
	]);
});

moduleStory.it(
	"a read policy that reads the store answers alice's own note and denies bob",
	[noteStored("alice", "Groceries")],
	function* ({ read }) {
		yield* outcomes([
			["alice", () => read("alice", 1), "note 1: Groceries"],
			["bob", () => read("bob", 1), "failed with read denied"],
		]);
	},
);

moduleStory.it(
	"the same read policy denies bob's live subscription to alice's note and sends alice its result",
	[noteStored("alice", "Groceries")],
	function* ({ subscribe }) {
		yield* outcomes([
			["bob", () => subscribe("bob", 1), "failed with read denied"],
			["alice", () => subscribe("alice", 1), "note 1: Groceries"],
		]);
	},
);

moduleStory.it(
	"a command without invalidates announces only the note its write announces, so readers of another note hear nothing",
	[],
	function* ({ create, heardAnnouncements }) {
		yield* create("alice", "Groceries");

		expect(yield* heardAnnouncements()).toEqual(["note 1"]);
	},
);

moduleStory.it(
	"a retryable store failure in the read policy of a live subscription answers ServiceUnavailable",
	[noteStored("alice", "Groceries"), storeFails("unavailable")],
	function* ({ subscribe }) {
		expect(yield* subscribe("alice", 1)).toBe("failed with service unavailable");
	},
);

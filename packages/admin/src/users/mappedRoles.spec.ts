import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { alreadyAssigned, isRegistered, mappedUsersStory } from "#test/usersStory.ts";

mappedUsersStory.it("the admin user list reads roles from the mapped user table", [], function* ({ rolesSeenBy }) {
	expect(yield* rolesSeenBy("alice")).toEqual({ alice: "owner", bob: "user", carol: "auditor" });
});

mappedUsersStory.it("alice assigns bob auditor through the mapped users page", [], function* ({ assign, rolesSeenBy }) {
	yield* assign("alice", "bob", "auditor");

	expect(yield* rolesSeenBy("bob")).toEqual({ alice: "owner", bob: "auditor", carol: "auditor" });
});

mappedUsersStory.it("the mapped assignment protects the last role assigner", [], function* ({ assign, rolesSeenBy }) {
	const answer = yield* assign("alice", "alice", "admin");

	yield* outcomes([
		["assignment refusal", () => Effect.succeed(answer), "alice is the last role assigner"],
		["roles alice sees", () => rolesSeenBy("alice"), { alice: "owner", bob: "user", carol: "auditor" }],
	]);
});

mappedUsersStory.it(
	"alice can demote herself when mapped users include another role assigner",
	[alreadyAssigned("alice", "bob", "delegate")],
	function* ({ assign, rolesSeenBy }) {
		yield* assign("alice", "alice", "admin");

		expect(yield* rolesSeenBy("alice")).toEqual({ alice: "admin", bob: "delegate", carol: "auditor" });
	},
);

mappedUsersStory.it("the mapped list pages by user id", [], function* ({ page }) {
	yield* outcomes([
		["first page", () => page("alice", { limit: 2 }), { next: "after bob", users: ["alice", "bob"] }],
		["last page", () => page("alice", { cursor: "bob", limit: 2 }), { next: "last page", users: ["carol"] }],
	]);
});

mappedUsersStory.it(
	"the mapped list reads the user's creation instant",
	[isRegistered("dana", "user", "2026-10-20T14:34:56.789+02:00")],
	function* ({ creationTimesSeenBy }) {
		expect(yield* creationTimesSeenBy("alice")).toMatchObject({ dana: "2026-10-20T12:34:56.789Z" });
	},
);

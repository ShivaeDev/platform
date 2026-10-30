import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { alreadyAssigned, isRegistered, usersStory } from "#test/usersStory.ts";

usersStory.it(
	"after alice makes bob an auditor, bob's next request lists every user and shows him as auditor",
	[],
	function* ({ assign, rolesSeenBy }) {
		expect(yield* rolesSeenBy("bob")).toBe("forbidden");

		yield* assign("alice", "bob", "auditor");

		expect(yield* rolesSeenBy("bob")).toEqual({ alice: "owner", bob: "auditor", carol: "auditor" });
	},
);

usersStory.it(
	"carol, an auditor who cannot assign roles, is forbidden to make bob an owner, and bob stays a user",
	[],
	function* ({ answerTo, assign, rolesSeenBy }) {
		yield* assign("carol", "bob", "owner");

		yield* outcomes({
			"carol's answer": [answerTo("carol"), "forbidden"],
			"roles alice sees": [rolesSeenBy("alice"), { alice: "owner", bob: "user", carol: "auditor" }],
		});
	},
);

usersStory.it(
	"alice, the only user who can assign roles, is refused making herself an admin and stays the owner",
	[],
	function* ({ answerTo, assign, rolesSeenBy }) {
		yield* assign("alice", "alice", "admin");

		yield* outcomes({
			"alice's answer": [answerTo("alice"), "alice is the last role assigner"],
			"roles alice sees": [rolesSeenBy("alice"), { alice: "owner", bob: "user", carol: "auditor" }],
		});
	},
);

usersStory.it(
	"once bob is a delegate who can assign roles, alice can make herself an admin",
	[alreadyAssigned("alice", "bob", "delegate")],
	function* ({ assign, rolesSeenBy }) {
		expect(yield* rolesSeenBy("alice")).toEqual({ alice: "owner", bob: "delegate", carol: "auditor" });

		yield* assign("alice", "alice", "admin");

		expect(yield* rolesSeenBy("alice")).toEqual({ alice: "admin", bob: "delegate", carol: "auditor" });
	},
);

usersStory.it(
	"bob, a delegate left as the only user who can assign roles, is refused making himself an auditor",
	[alreadyAssigned("alice", "bob", "delegate"), alreadyAssigned("alice", "alice", "admin")],
	function* ({ assign }) {
		expect(yield* assign("bob", "bob", "auditor")).toBe("bob is the last role assigner");
	},
);

usersStory.it("alice assigning a role to a user who is not registered is told the user is not found", [], function* ({ assign }) {
	expect(yield* assign("alice", "nobody", "auditor")).toBe("not found");
});

usersStory.it(
	"alice making bob an auditor logs alice as the actor, bob, the auditor role and a time during the assignment",
	[],
	function* ({ assign, roleChangeLog }) {
		yield* assign("alice", "bob", "auditor");

		expect(yield* roleChangeLog()).toEqual([{ actor: "alice", changedAt: "during the assignment", role: "auditor", user: "bob" }]);
	},
);

usersStory.it(
	"alice's first page of two users lists aaron and alice in id order and continues after alice",
	[isRegistered("aaron", "user")],
	function* ({ page }) {
		expect(yield* page("alice", { limit: 2 })).toEqual({ next: "after alice", users: ["aaron", "alice"] });
	},
);

usersStory.it("alice's page of two users after alice lists bob and carol as the last page", [isRegistered("aaron", "user")], function* ({ page }) {
	expect(yield* page("alice", { cursor: "alice", limit: 2 })).toEqual({ next: "last page", users: ["bob", "carol"] });
});

for (const [limit, shown] of [
	[1, { next: "after aaron", users: ["aaron"] }],
	[100, { next: "last page", users: ["aaron", "alice", "bob", "carol"] }],
] as const) {
	usersStory.it(`alice may ask for a page of ${limit}, which lists ${shown.users.join(", ")}`, [isRegistered("aaron", "user")], function* ({ page }) {
		expect(yield* page("alice", { limit })).toEqual(shown);
	});
}

for (const limit of [0, 101, 1.5]) {
	usersStory.it(`alice's request for a page of ${limit} users is refused as an invalid page request`, [], function* ({ page }) {
		expect(yield* page("alice", { limit })).toBe("invalid page request");
	});
}

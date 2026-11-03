import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { socketPolicyStory } from "#test/socket-policy/story.ts";

socketPolicyStory.it(
	"a scope-only socket subscription discovers new lists and follows their later record changes",
	[],
	function* ({ createList, nextHint, save, subscribe, timeline }) {
		yield* createList(1, "alice");
		yield* save(1, 1, "First");
		yield* subscribe("alice", "timeline");
		expect(yield* timeline()).toEqual(["First"]);

		yield* save(1, 1, "Changed");

		yield* outcomes([
			["changed record hint", () => nextHint("timeline"), expect.stringContaining("changed")],
			["current timeline", () => timeline(), ["Changed"]],
		]);

		yield* createList(2, "alice");
		yield* nextHint("timeline");
		yield* save(2, 2, "New list");

		yield* outcomes([
			["new list's record hint", () => nextHint("timeline"), expect.stringContaining("changed")],
			["timeline with the new list", () => timeline(), ["Changed", "New list"]],
		]);
	},
);

socketPolicyStory.it("alice cannot read or subscribe to bob's derived scope", [], function* ({ subscriptionRefusal, timeline }) {
	yield* outcomes([
		["read refusal", () => timeline("bob"), "failed with query read denied"],
		["subscription refusal", () => subscriptionRefusal("timeline", "bob"), "failed with query read denied"],
	]);
});

socketPolicyStory.it("a member without collection permission cannot read or subscribe over the socket", [], function* ({ all, subscriptionRefusal }) {
	yield* outcomes([
		["read refusal", () => all("alice"), "failed with query read denied"],
		["subscription refusal", () => subscriptionRefusal("all"), "failed with query read denied"],
	]);
});

socketPolicyStory.it(
	"an admin's collection subscription follows writes in two owners' lists",
	[],
	function* ({ all, createList, nextHint, save, subscribe }) {
		yield* createList(1, "alice");
		yield* createList(2, "bob");
		yield* subscribe("admin", "all");
		expect(yield* all()).toEqual([]);

		yield* save(1, 1, "Alice's note");

		yield* outcomes([
			["alice's record hint", () => nextHint("all"), expect.stringContaining("changed")],
			["collection after alice's write", () => all(), ["Alice's note"]],
		]);

		yield* save(2, 2, "Bob's note");

		yield* outcomes([
			["bob's record hint", () => nextHint("all"), expect.stringContaining("changed")],
			["collection after bob's write", () => all(), ["Alice's note", "Bob's note"]],
		]);
	},
);

socketPolicyStory.it(
	"a collection subscription denies revoked permission and resumes after permission returns",
	[],
	function* ({ all, createList, nextHint, restoreAdmin, revokeAdmin, save, subscribe }) {
		yield* createList(1, "alice");
		yield* subscribe("admin", "all");
		expect(yield* all()).toEqual([]);
		yield* revokeAdmin();

		yield* save(1, 1, "Private");

		yield* outcomes([
			["subscription denial", () => nextHint("all"), "query read denied"],
			["read refusal", () => all(), "failed with query read denied"],
		]);
		yield* restoreAdmin();

		yield* save(1, 1, "Visible again");

		yield* outcomes([
			["resumed delivery", () => nextHint("all"), expect.stringContaining("changed")],
			["authorized collection", () => all(), ["Visible again"]],
		]);
	},
);

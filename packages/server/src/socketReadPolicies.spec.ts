import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { socketPolicyStory } from "#test/socket-policy/story.ts";

socketPolicyStory.it(
	"a scope-only socket subscription discovers new lists and follows their later record changes",
	[],
	function* ({ createList, nextHint, save, subscribe, pushed }) {
		yield* createList(1, "alice");
		yield* save(1, 1, "First");
		yield* subscribe("alice", "timeline");
		expect(yield* pushed("timeline")).toEqual(["First"]);

		yield* save(1, 1, "Changed");

		yield* outcomes([
			["changed record hint", () => nextHint("timeline"), "result"],
			["current timeline", () => pushed("timeline"), ["Changed"]],
		]);

		yield* createList(2, "alice");
		yield* nextHint("timeline");
		yield* save(2, 2, "New list");

		yield* outcomes([
			["new list's record hint", () => nextHint("timeline"), "result"],
			["timeline with the new list", () => pushed("timeline"), ["Changed", "New list"]],
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
	function* ({ createList, nextHint, pushed, save, subscribe }) {
		yield* createList(1, "alice");
		yield* createList(2, "bob");
		yield* subscribe("admin", "all");
		expect(yield* pushed("all")).toEqual([]);

		yield* save(1, 1, "Alice's note");

		yield* outcomes([
			["alice's record hint", () => nextHint("all"), "result"],
			["collection after alice's write", () => pushed("all"), ["Alice's note"]],
		]);

		yield* save(2, 2, "Bob's note");

		yield* outcomes([
			["bob's record hint", () => nextHint("all"), "result"],
			["collection after bob's write", () => pushed("all"), ["Alice's note", "Bob's note"]],
		]);
	},
);

socketPolicyStory.it(
	"a collection subscription denies revoked permission and resumes after permission returns",
	[],
	function* ({ all, createList, nextHint, pushed, restoreAdmin, revokeAdmin, save, subscribe }) {
		yield* createList(1, "alice");
		yield* subscribe("admin", "all");
		expect(yield* pushed("all")).toEqual([]);
		yield* revokeAdmin();

		yield* save(1, 1, "Private");

		yield* outcomes([
			["subscription denial", () => nextHint("all"), "query read denied"],
			["read refusal", () => all(), "failed with query read denied"],
		]);
		yield* restoreAdmin();

		yield* save(1, 1, "Visible again");

		yield* outcomes([
			["resumed delivery", () => nextHint("all"), "result"],
			["authorized collection", () => pushed("all"), ["Visible again"]],
		]);
	},
);

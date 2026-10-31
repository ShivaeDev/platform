import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { listening, policyServicesStory } from "#test/policyServicesStory.ts";

for (const [person, read, hint] of [
	["alice", "team's document", "resync"],
	["bob", "failed with read denied", "failed with read denied"],
] as const) {
	policyServicesStory.it(
		`${person}'s request-local provider accounts decide both HTTP reads and live hints with a handler-only policy service`,
		[],
		function* ({ firstHint, read: readDocument }) {
			yield* outcomes({ "HTTP read": [readDocument(person), read], "live hint": [firstHint(person), hint] });
		},
	);
}

policyServicesStory.it("a handler-only policy service also permits an authorized rerun-and-compare result", [], function* ({ firstComparedValue }) {
	expect(yield* firstComparedValue("alice")).toBe("team's document");
});

policyServicesStory.it(
	"alice's provider-account policy permits an HTTP read and a later document change hint",
	[listening],
	function* ({ announce, heardChange, read }) {
		expect(yield* read("alice")).toBe("team's document");

		yield* announce();

		expect(yield* heardChange("alice")).toBe(true);
	},
);

policyServicesStory.it(
	"revoking provider-account access denies the next RPC read and ends the live subscription on a hint",
	[listening],
	function* ({ announce, read, revoke, subscriptionEnd }) {
		expect(yield* read("alice")).toBe("team's document");

		yield* revoke();
		yield* announce();

		yield* outcomes({
			"HTTP read": [read("alice"), "failed with read denied"],
			"live subscription": [subscriptionEnd("alice"), "failed with read denied"],
		});
	},
);

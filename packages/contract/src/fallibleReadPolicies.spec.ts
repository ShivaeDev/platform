import { expect } from "vitest";
import { readPolicyStory } from "#test/readPolicyStory.ts";

readPolicyStory.it("a PostgreSQL failure checking alice's live read reaches her as ServiceUnavailable", [], function* ({ failDatabase, liveRead }) {
	expect(yield* liveRead()).toBe("Alice's note");

	yield* failDatabase();

	expect(yield* liveRead()).toBe("failed with service unavailable");
});

readPolicyStory.it(
	"a PostgreSQL failure during a subscription's access recheck reaches alice as ServiceUnavailable",
	[],
	function* ({ announce, failDatabase, subscribe, subscriptionEnd }) {
		expect(yield* subscribe()).toBe("subscribed");
		yield* failDatabase();

		yield* announce();

		expect(yield* subscriptionEnd()).toBe("failed with service unavailable");
	},
);

readPolicyStory.it(
	"a PostgreSQL failure opening a live subscription reaches alice as ServiceUnavailable",
	[],
	function* ({ failDatabase, subscribe }) {
		yield* failDatabase();

		expect(yield* subscribe()).toBe("failed with service unavailable");
	},
);

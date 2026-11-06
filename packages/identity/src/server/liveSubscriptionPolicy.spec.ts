import { expect } from "vitest";
import { liveSubscriptionStory } from "#test/rpc/liveSubscriptionStory.ts";

liveSubscriptionStory.it("revoking alice's role replaces the next delivery with a denial", [], function* ({ nextHint, publish, revokeAliceRole }) {
	expect(yield* nextHint()).toBe("alice's document for reader");

	yield* revokeAliceRole();
	yield* publish();

	expect(yield* nextHint()).toBe("read denied");
});

liveSubscriptionStory.it(
	"granting alice read access after a denial resumes the same subscription on the next hint",
	[],
	function* ({ grantAliceRead, nextHint, publish, revokeAliceRole }) {
		expect(yield* nextHint()).toBe("alice's document for reader");
		yield* revokeAliceRole();
		yield* publish();
		expect(yield* nextHint()).toBe("read denied");

		yield* grantAliceRead();
		yield* publish();

		expect(yield* nextHint()).toBe("alice's document for reader");
	},
);

liveSubscriptionStory.it(
	"signing alice out ends her subscription on the next hint",
	[],
	function* ({ aliceSignsOut, nextHint, publish, subscriptionEnding }) {
		expect(yield* nextHint()).toBe("alice's document for reader");

		yield* aliceSignsOut();
		yield* publish();

		expect(yield* subscriptionEnding()).toBe("failed with unauthorized");
	},
);

liveSubscriptionStory.it(
	"a pushed query reads alice's current role after access returns",
	[],
	function* ({ grantAliceRead, nextHint, publish, revokeAliceRole }) {
		expect(yield* nextHint()).toBe("alice's document for reader");
		yield* revokeAliceRole();
		yield* publish();
		expect(yield* nextHint()).toBe("read denied");

		yield* grantAliceRead("editor");
		yield* publish();

		expect(yield* nextHint()).toBe("alice's document for editor");
	},
);

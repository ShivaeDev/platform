import { expect } from "vitest";
import { liveSubscriptionStory, pushedSubscriptionStory } from "#test/rpc/liveSubscriptionStory.ts";

for (const [delivery, story, first] of [
	["hints", liveSubscriptionStory, "resync"],
	["pushed", pushedSubscriptionStory, "alice's document for reader"],
] as const) {
	story.it(`${delivery}: revoking alice's role replaces the next delivery with a denial`, [], function* ({ nextHint, publish, revokeAliceRole }) {
		expect(yield* nextHint()).toBe(first);

		yield* revokeAliceRole();
		yield* publish();

		expect(yield* nextHint()).toBe("read denied");
	});

	story.it(
		`${delivery}: granting alice read access after a denial resumes the same subscription on the next hint`,
		[],
		function* ({ grantAliceRead, nextHint, publish, revokeAliceRole }) {
			expect(yield* nextHint()).toBe(first);
			yield* revokeAliceRole();
			yield* publish();
			expect(yield* nextHint()).toBe("read denied");

			yield* grantAliceRead();
			yield* publish();

			expect(yield* nextHint()).toBe(delivery === "pushed" ? first : "changed");
		},
	);

	story.it(
		`${delivery}: signing alice out ends her subscription on the next hint`,
		[],
		function* ({ aliceSignsOut, nextHint, publish, subscriptionEnding }) {
			expect(yield* nextHint()).toBe(first);

			yield* aliceSignsOut();
			yield* publish();

			expect(yield* subscriptionEnding()).toBe("failed with unauthorized");
		},
	);
}

pushedSubscriptionStory.it(
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

import { expect } from "vitest";
import { socketIdleStory } from "#test/socket-idle/story.ts";

socketIdleStory.it("four idle streams on one hosted socket share one session lookup per interval", [], function* ({ intervalPasses, lookupCount }) {
	yield* intervalPasses();

	expect(lookupCount()).toEqual({ sessionLookups: 1 });

	yield* intervalPasses();

	expect(lookupCount()).toEqual({ sessionLookups: 2 });
});

socketIdleStory.it(
	"sign-out ends all four idle streams on the hosted socket at the next interval",
	[],
	function* ({ intervalPasses, signOut, streamEnds }) {
		yield* signOut();

		yield* intervalPasses();

		expect(yield* streamEnds()).toEqual(new Array(4).fill("failed with unauthorized"));
	},
);

socketIdleStory.it(
	"a session provider outage ends all four idle streams as auth unavailable",
	[],
	function* ({ intervalPasses, providerOutage, streamEnds }) {
		yield* providerOutage();

		yield* intervalPasses();

		expect(yield* streamEnds()).toEqual(new Array(4).fill("failed with auth unavailable"));
	},
);

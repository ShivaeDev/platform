import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { liveNotesStory, serverRefusesStreams } from "#test/liveNotesStory.ts";

liveNotesStory.it(
	"a bound live subscription for two hints hears the server's resync and then the change naming note 1, completes and closes its server stream",
	[],
	function* ({ edit, hintsHeard, openServerStreams, serverStreamClosed, subscribe, subscriptionEnding }) {
		yield* subscribe(2);
		expect(yield* openServerStreams()).toBe("one stream open");

		yield* edit(1, "Changed");

		yield* outcomes({
			hints: [hintsHeard(), ["resync", "changed notes 1"]],
			"server stream": [serverStreamClosed(), "closed"],
			subscription: [subscriptionEnding(), "completed"],
		});
	},
);

liveNotesStory.it(
	"interrupting a bound live subscription closes its server stream",
	[],
	function* ({ interruptSubscription, openServerStreams, serverStreamClosed, subscribe, subscriptionEnding }) {
		yield* subscribe();
		expect(yield* openServerStreams()).toBe("one stream open");

		yield* interruptSubscription();

		yield* outcomes({
			"server stream": [serverStreamClosed(), "closed"],
			subscription: [subscriptionEnding(), "interrupted"],
		});
	},
);

liveNotesStory.it(
	"a refused bound live subscription fails with the declared unavailable rejection, decoded as its class",
	[serverRefusesStreams()],
	function* ({ subscribe, subscriptionEnding }) {
		yield* subscribe();

		expect(yield* subscriptionEnding()).toBe("failed with unavailable");
	},
);

import { expect } from "vitest";
import { aliceSubscribesTo, revalidatesEvery, sharedConnection, streamSession } from "#test/rpc/streamSession.ts";

const streams = [aliceSubscribesTo("Identity"), aliceSubscribesTo("Profile"), aliceSubscribesTo("Accounts"), aliceSubscribesTo("Optional")];
streamSession.it(
	"one socket session lookup revalidates all four idle streams at the interval",
	[revalidatesEvery("5 seconds"), sharedConnection, ...streams],
	function* ({ lookupCount, revalidationIntervalPasses }) {
		const before = lookupCount();

		yield* revalidationIntervalPasses();

		expect({ sessionLookups: lookupCount() - before }).toEqual({ sessionLookups: 1 });
	},
);
streamSession.it(
	"signing out ends every idle stream on one socket at the next interval",
	[revalidatesEvery("5 seconds"), sharedConnection, ...streams],
	function* ({ aliceSignsOut, revalidationIntervalPasses, streamEnds }) {
		yield* aliceSignsOut();

		yield* revalidationIntervalPasses();

		expect(yield* streamEnds()).toEqual(["unauthorized", "unauthorized", "unauthorized", "unauthorized"]);
	},
);

streamSession.it(
	"a session-store outage ends every idle stream on one socket as auth unavailable at the next interval",
	[revalidatesEvery("5 seconds"), sharedConnection, ...streams],
	function* ({ revalidationIntervalPasses, sessionStoreBlips, streamEnds }) {
		yield* sessionStoreBlips();

		yield* revalidationIntervalPasses();

		expect(yield* streamEnds()).toEqual(["auth unavailable", "auth unavailable", "auth unavailable", "auth unavailable"]);
	},
);

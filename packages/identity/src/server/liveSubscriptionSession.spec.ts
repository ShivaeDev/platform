import { expect } from "vitest";
import { liveSubscriptionStory } from "#test/rpc/liveSubscriptionStory.ts";

for (const [removal, action] of [
	["sign-out", "aliceSignsOut"],
	["revocation", "aliceSessionIsRevoked"],
	["expiry", "aliceSessionExpires"],
] as const) {
	for (const [trigger, detect] of [
		["the revalidation interval", "revalidationIntervalPasses"],
		["a change hint", "publish"],
	] as const) {
		liveSubscriptionStory.it(`${removal} ends an open WebSocket subscription with Unauthorized after ${trigger}`, [], function* (verbs) {
			expect(yield* verbs.nextHint()).toBe("resync");

			yield* verbs[action]();
			yield* verbs[detect]();

			expect(yield* verbs.subscriptionEnding()).toBe("failed with unauthorized");
		});
	}
}
liveSubscriptionStory.it("a signed-in viewer whose policy refuses receives a denial", [], function* ({ denyAliceRead, nextHint, publish }) {
	expect(yield* nextHint()).toBe("resync");

	yield* denyAliceRead();
	yield* publish();

	expect(yield* nextHint()).toBe("read denied");
});

for (const [trigger, detect] of [
	["a change hint", "publish"],
	["the revalidation interval", "revalidationIntervalPasses"],
] as const) {
	liveSubscriptionStory.it(`a session-store outage ends an open WebSocket subscription with AuthUnavailable after ${trigger}`, [], function* (verbs) {
		expect(yield* verbs.nextHint()).toBe("resync");

		yield* verbs.sessionStoreBecomesUnavailable();
		yield* verbs[detect]();

		expect(yield* verbs.subscriptionEnding()).toBe("failed with auth unavailable");
	});
}

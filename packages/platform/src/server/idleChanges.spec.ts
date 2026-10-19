import { Fiber } from "effect";
import { expect } from "vitest";
import { hostChangesStory } from "#test/hostChangesStory.ts";

hostChangesStory.it(
	"a host without a changes service opens an idle subscription under its contract middleware",
	[],
	function* ({ subscribe, awaitSubscribed }) {
		const subscription = yield* subscribe();
		yield* awaitSubscribed();
		expect(subscription.pollUnsafe()).toBeUndefined();
		yield* Fiber.interrupt(subscription);
	},
);

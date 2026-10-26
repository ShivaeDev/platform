import { Fiber } from "effect";
import { expect } from "vitest";
import { applicationHandlersStory, hostChangesStory } from "#test/hostChangesStory.ts";

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

applicationHandlersStory.it("application handlers serve requests while the host completes the changes stream", [], function* ({ greet, subscribe }) {
	expect(yield* greet("Ada")).toBe("Hello, Ada");
	expect(yield* subscribe()).toEqual([{ _tag: "Resync" }]);
});

import { expect } from "vitest";
import { applicationHandlersStory, hostChangesStory } from "#test/hostChangesStory.ts";

hostChangesStory.it(
	"a host without a changes service runs the contract middleware for a subscription and keeps it open without hints",
	[],
	function* ({ subscribe, subscriptionAfterAnotherRequest }) {
		yield* subscribe();

		expect(yield* subscriptionAfterAnotherRequest()).toEqual({ hints: [], state: "open" });
	},
);

applicationHandlersStory.it("a host with a changes service still answers its application handlers", [], function* ({ greet }) {
	expect(yield* greet("Ada")).toBe("Hello, Ada");
});

applicationHandlersStory.it("a host with a changes service opens each subscription with a resync", [], function* ({ firstHint }) {
	expect(yield* firstHint()).toBe("resync");
});

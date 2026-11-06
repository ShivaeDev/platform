import { expect } from "vitest";
import { applicationHandlersStory, customHandlerStory, hostChangesStory } from "#test/hostChangesStory.ts";

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

applicationHandlersStory.it("a host with a changes service opens each subscription with its result", [], function* ({ firstHint }) {
	expect(yield* firstHint()).toBe("result");
});

customHandlerStory.it(
	"a host without a changes service preserves a custom subscription and its middleware-provided greeting",
	[],
	function* ({ firstHint }) {
		expect(yield* firstHint()).toBe("result");
	},
);

hostChangesStory.it("a host without a changes service sends the query result on its subscription", [], function* ({ firstResult }) {
	expect(yield* firstResult()).toEqual({ _tag: "Result", query: "greet", queryIndex: 0, value: "Hello, Ada" });
});

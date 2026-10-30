import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { serviceBuilt, serviceStory } from "#test/serviceStory.ts";

serviceStory.it(
	"a method greets with the greeting the Layer was built with, even when its caller provides another",
	[serviceBuilt({ greeting: "hello from the Layer" })],
	function* ({ greet }) {
		expect(yield* greet({ callerProvides: "hello from the caller" })).toBe("hello from the Layer");
	},
);

serviceStory.it(
	"two calls count on the private state of the Layer's one initializer run, without running the initializer or building the methods again",
	[serviceBuilt()],
	function* ({ call, answers, initializerRuns, methodBuilds }) {
		yield* outcomes({
			"initializer runs": [initializerRuns(), 1],
			"method builds": [methodBuilds(), 1],
		});

		yield* call("count");
		yield* call("count");

		yield* outcomes({
			"initializer runs": [initializerRuns(), 1],
			"method builds": [methodBuilds(), 1],
			"what the calls returned": [answers(), [1, 2]],
		});
	},
);

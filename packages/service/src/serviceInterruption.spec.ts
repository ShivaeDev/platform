import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { buildWaitsInInitializer, callHoldsResource, serviceBuilt, serviceStory } from "#test/serviceStory.ts";

serviceStory.it(
	"interrupting the caller's running call ends it as interrupted and releases that call's resource and not the initializer's",
	[serviceBuilt(), callHoldsResource()],
	function* ({ interruptCall, answers, released }) {
		expect(yield* released()).toEqual([]);

		yield* interruptCall();

		yield* outcomes({
			"released resources": [released(), ["the call's resource"]],
			"the call": [answers(), ["interrupted"]],
		});
	},
);

serviceStory.it(
	"interrupting the Layer's build while its initializer waits ends the build as interrupted and releases the initializer's resource",
	[buildWaitsInInitializer()],
	function* ({ interruptBuild, buildOutcome, released }) {
		expect(yield* released()).toEqual([]);

		yield* interruptBuild();

		yield* outcomes({
			"released resources": [released(), ["the initializer's resource"]],
			"the build": [buildOutcome(), "interrupted"],
		});
	},
);

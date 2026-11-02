import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { buildWaitsInInitializer, callHoldsResource, serviceBuilt, serviceStory } from "#test/serviceStory.ts";

serviceStory.it(
	"interrupting the caller's running call ends it as interrupted and releases that call's resource and not the initializer's",
	[serviceBuilt(), callHoldsResource()],
	function* ({ interruptCall, answers, released }) {
		expect(yield* released()).toEqual([]);

		yield* interruptCall();

		yield* outcomes([
			["released resources", () => released(), ["the call's resource"]],
			["the call", () => answers(), ["interrupted"]],
		]);
	},
);

serviceStory.it(
	"interrupting the Layer's build while its initializer waits ends the build as interrupted and releases the initializer's resource",
	[buildWaitsInInitializer()],
	function* ({ interruptBuild, buildOutcome, released }) {
		expect(yield* released()).toEqual([]);

		yield* interruptBuild();

		yield* outcomes([
			["released resources", () => released(), ["the initializer's resource"]],
			["the build", () => buildOutcome(), "interrupted"],
		]);
	},
);

serviceStory.it(
	"after interrupting a call, the same service's count continues from 1 to 2 without rebuilding its initializer or methods",
	[serviceBuilt(), callHoldsResource()],
	function* ({ call, interruptCall, answers, initializerRuns, methodBuilds }) {
		yield* call("count");

		expect(yield* answers()).toEqual([1]);

		yield* interruptCall();
		yield* call("count");

		yield* outcomes([
			["the calls", () => answers(), [1, "interrupted", 2]],
			["initializer runs", () => initializerRuns(), 1],
			["method builds", () => methodBuilds(), 1],
		]);
	},
);

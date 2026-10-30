import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { initializationFails, serviceBuilt, serviceStory } from "#test/serviceStory.ts";

serviceStory.it(
	"when initialization fails after acquiring its resource, building the Layer fails with that error, releases the resource and builds no methods",
	[initializationFails()],
	function* ({ build, buildOutcome, released, methodBuilds }) {
		yield* build();

		yield* outcomes({
			"method builds": [methodBuilds(), 0],
			"released resources": [released(), ["the initializer's resource"]],
			"the build": [buildOutcome(), "failed with initialization failure"],
		});
	},
);

for (const [method, ending] of [
	["fail", "failed with method failure"],
	["crash", "died with method defect"],
] as const) {
	serviceStory.it(
		`a call to ${method} ends as "${ending}" for its caller after counting once, and the next count on the same private state returns 2`,
		[serviceBuilt()],
		function* ({ call, answers }) {
			yield* call(method);
			yield* call("count");

			expect(yield* answers()).toEqual([ending, 2]);
		},
	);
}

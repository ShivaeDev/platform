import { expect } from "@effect/vitest";
import { declaresRequirement, declaresScopedService, serviceStory } from "#test/serviceStory.ts";

serviceStory.it("provides the declared requirement to initialization and methods", [declaresRequirement()], function* ({ build, sameIdentity }) {
	yield* build();
	expect(yield* sameIdentity()).toBe(true);
});

serviceStory.it(
	"initializes private state and constructs methods once per layer",
	[declaresScopedService()],
	function* ({ build, close, identity, story }) {
		yield* build();
		const first = yield* identity();
		const second = yield* identity();
		expect(first).toBe(second);
		expect(story.engine.counts.initializations).toBe(1);
		expect(story.engine.counts.factoryCalls).toBe(1);
		expect(story.engine.counts.finalizations).toBe(0);

		yield* close();
		expect(story.engine.counts.finalizations).toBe(1);
	},
);

serviceStory.it(
	"keeps declared dependencies bound when the caller provides another value",
	[declaresRequirement("declared")],
	function* ({ build, greet }) {
		yield* build();
		expect(yield* greet({ callerPrefix: "caller" })).toBe("declared");
	},
);

serviceStory.it(
	"releases method resources with the caller scope while the service remains live",
	[declaresScopedService()],
	function* ({ build, open, released, story }) {
		yield* build();
		expect(yield* open()).toBe("resource");
		expect(yield* released()).toBe(1);
		expect(story.engine.counts.finalizations).toBe(0);

		expect(yield* open()).toBe("resource");
		expect(yield* released()).toBe(2);
		expect(story.engine.counts.finalizations).toBe(0);
	},
);

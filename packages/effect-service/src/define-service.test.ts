import { expect } from "@effect/vitest";
import { declaresRequirement, serviceStory } from "#test/serviceStory.ts";

serviceStory.it("provides the declared requirement to initialization and methods", [declaresRequirement()], function* ({ requirement }) {
	expect((yield* requirement()).sameIdentity).toBe(true);
});

serviceStory.it("initializes private state and constructs methods once per layer", [], function* ({ identities, lifetime }) {
	const [first, second] = yield* identities();
	expect(first).toBe(second);
	expect(lifetime()).toMatchObject({ factoryCalls: 1, finalizations: 1, initializations: 1 });
});

serviceStory.it(
	"keeps declared dependencies bound when the caller provides another value",
	[declaresRequirement("declared")],
	function* ({ requirement }) {
		expect((yield* requirement("caller")).prefix).toBe("declared");
	},
);

serviceStory.it("releases method resources with the caller scope while the service remains live", [], function* ({ callerResources }) {
	expect(yield* callerResources()).toEqual({ afterFirst: 1, afterSecond: 2, finalizations: 0, resources: ["resource", "resource"] });
});

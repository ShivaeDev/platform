import { expect } from "@effect/vitest";
import { callOpensResource, ownerHoldsService, serviceBuilt, serviceStory } from "#test/serviceStory.ts";

serviceStory.it(
	"closing the caller's scope releases the resource its call opened there and not the initializer's",
	[serviceBuilt(), callOpensResource()],
	function* ({ closeCallerScope, released }) {
		expect(yield* released()).toEqual([]);

		yield* closeCallerScope();

		expect(yield* released()).toEqual(["the call's resource"]);
	},
);

serviceStory.it("closing the Layer's scope releases the initializer's resource", [serviceBuilt()], function* ({ closeLayer, released }) {
	expect(yield* released()).toEqual([]);

	yield* closeLayer();

	expect(yield* released()).toEqual(["the initializer's resource"]);
});

serviceStory.it(
	"interrupting the owner that provides the Layer releases the initializer's resource",
	[ownerHoldsService()],
	function* ({ interruptOwner, released }) {
		expect(yield* released()).toEqual([]);

		yield* interruptOwner();

		expect(yield* released()).toEqual(["the initializer's resource"]);
	},
);

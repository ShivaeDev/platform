import { expect } from "@effect/vitest";
import { serviceBuilt, serviceStory } from "#test/serviceStory.ts";

serviceStory.it(
	"a generic method runs its argument with the number the caller provides and returns that number wrapped with its initialized greeting",
	[serviceBuilt()],
	function* ({ wrapCallersNumber }) {
		expect(yield* wrapCallersNumber(42)).toEqual({ greeting: "hello", value: 42 });
	},
);

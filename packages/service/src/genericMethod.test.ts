import { expect } from "@effect/vitest";
import { serviceBuilt, serviceStory } from "#test/serviceStory.ts";

serviceStory.it(
	"a generic method runs its argument with the number the caller provides and returns that number wrapped with its initialized greeting",
	[serviceBuilt()],
	function* ({ wrapCallersNumber }) {
		expect(yield* wrapCallersNumber(42)).toEqual({ greeting: "hello", value: 42 });
	},
);

serviceStory.it(
	"a generic method propagates the argument's failure containing the number supplied by its caller",
	[serviceBuilt()],
	function* ({ wrapCallersFailure }) {
		expect(yield* wrapCallersFailure(17)).toMatchObject({ number: 17 });
	},
);

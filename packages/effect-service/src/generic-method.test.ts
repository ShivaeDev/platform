import { expect } from "@effect/vitest";
import { declaresGenericMethod, serviceStory } from "#test/serviceStory.ts";

serviceStory.it("preserves each generic call's caller requirement", [declaresGenericMethod()], function* ({ preserveCaller }) {
	expect(yield* preserveCaller(42)).toEqual({ value: 42 });
});

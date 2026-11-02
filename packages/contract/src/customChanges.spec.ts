import { expect } from "vitest";
import { customChangesStory } from "#test/customChangesStory.ts";

customChangesStory.it("a custom subscription pushes the counter's decoded bigint after a command", [], function* ({ set, subscribedValue }) {
	expect(yield* subscribedValue()).toBe("bigint 0");

	yield* set(42n);

	expect(yield* subscribedValue()).toBe("bigint 42");
});

customChangesStory.it("a custom subscription preserves a declared rerun failure", [], function* ({ failReads, subscribedValue }) {
	yield* failReads();

	expect(yield* subscribedValue()).toBe("failed with unavailable");
});

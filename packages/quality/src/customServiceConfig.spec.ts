import { expect } from "vitest";
import { customServiceStory } from "#test/customServiceStory.ts";

customServiceStory.it("quality reports findings from a typed rule with a supplied custom service", [], function* ({ checks, report }) {
	yield* checks();

	expect(yield* report()).toContain(
		"error local/line-limit (1)\n  Keep files within the supplied line allowance.\n  src/value.ts  3 lines exceed 2.",
	);
});

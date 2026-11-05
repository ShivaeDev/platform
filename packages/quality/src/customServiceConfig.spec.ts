import { assertThat } from "@shivaedev/test-kits/quality/adapters/assertThat.ts";
import { customServiceStory } from "#test/customServiceStory.ts";

customServiceStory.it("quality reports findings from a typed rule with a supplied custom service", [], function* ({ checks, report }) {
	yield* checks();

	yield* assertThat(yield* report(), (actual) =>
		actual.toContain("error local/line-limit (1)\n  Keep files within the supplied line allowance.\n  src/value.ts  3 lines exceed 2."),
	);
});

import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { ciEnvironment, outputPolicyStory } from "#test/outputPolicyStory.ts";

outputPolicyStory.it("in CI, a passing test's diagnostic stays in the output", [ciEnvironment("true")], function* ({ output, runsPassingTest }) {
	yield* runsPassingTest();

	expect(yield* output()).toContain("diagnostic from a passing test");
});

outputPolicyStory.it(
	"outside CI, the output reports the passing test but hides its diagnostic",
	[ciEnvironment("")],
	function* ({ output, runsPassingTest }) {
		yield* runsPassingTest();

		yield* outcomes({
			"diagnostic": [output(), expect.not.stringContaining("diagnostic from a passing test")],
			"result": [output(), expect.stringContaining("1 passed")],
		});
	},
);

import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { domainOutcomes } from "#rules/stories/domainOutcomes.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { inStory } from "#test/storySpecFiles.ts";

const SPEC = "src/orders.spec.ts";

const VITEST = 'import { expect } from "vitest";';

for (const [shape, imports, line] of [
	["an Exit helper", 'import { Exit } from "effect";', "expect(Exit.isFailure(exit)).toBe(true);"],
	["a Cause helper", 'import { Cause } from "effect";', "expect(Cause.hasDies(cause)).toBe(true);"],
	["a Result helper from effect/Result", 'import * as Result from "effect/Result";', "expect(Result.isSuccess(result)).toBe(true);"],
	["a _tag read", VITEST, 'expect(error._tag).toBe("Forbidden");'],
	["a destructured _tag", VITEST, "const { _tag } = answer;"],
	["a Failure literal around a domain tag", VITEST, 'expect(saved).toMatchObject({ _tag: "Failure", failure: { _tag: "Rejected" } });'],
] as const) {
	ruleStory.it(
		`tests/domain-outcomes reports ${shape} in a story once and asks for the outcome in the domain's words`,
		[repositoryHas({ content: `${imports}\n${inStory(line)}`, path: SPEC })],
		function* ({ check, locations, messages }) {
			yield* check(domainOutcomes);

			yield* outcomes([
				["advice", () => messages(), [expect.stringContaining("return the outcome in the domain's words")]],
				["locations", () => locations(), [`${SPEC}:3`]],
			]);
		},
	);
}

ruleStory.it(
	"tests/domain-outcomes accepts a domain tagged value such as Resync in a story",
	[repositoryHas({ content: `${VITEST}\n${inStory('expect(yield* nextMessage()).toEqual({ _tag: "Resync" });')}`, path: SPEC })],
	function* ({ check }) {
		expect(yield* check(domainOutcomes)).toEqual([]);
	},
);

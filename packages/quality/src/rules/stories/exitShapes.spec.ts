import { expect } from "vitest";
import { repositoryHas, ruleKit } from "#rule-story";
import { domainOutcomes } from "#rules/stories/domainOutcomes.ts";
import { inStory } from "#test/storySpecFiles.ts";

const SPEC = "src/orders.spec.ts";

ruleKit.it(
	"a spec is told to return domain words from the kit for each Exit, Cause or Result use, _tag read and Failure or Success literal",
	[
		repositoryHas({
			content: [
				'import { Cause, Effect, Exit } from "effect";',
				'import * as Result from "effect/Result";',
				"expect(Exit.isFailure(exit) && Cause.hasDies(exit.cause)).toBe(true);",
				"expect(Result.isSuccess(result)).toBe(true);",
				'expect(error._tag).toBe("Forbidden");',
				"const { _tag } = answer;",
				'expect(saved).toMatchObject({ _tag: "Failure", failure: { _tag: "Rejected" } });',
			].join("\n"),
			path: SPEC,
		}),
	],
	function* ({ checks }) {
		const findings = yield* checks(domainOutcomes);

		expect(findings).toEqual(
			[3, 3, 4, 5, 6, 7].map((line) => ({ file: SPEC, line, message: expect.stringContaining("return the outcome in the domain's words") })),
		);
	},
);

ruleKit.it(
	"domain tagged values in a spec, and Exit handling in the kit, a type test or a unit test, pass",
	[
		repositoryHas(
			{ content: inStory('expect(yield* nextMessage()).toEqual({ _tag: "Resync" });'), path: SPEC },
			{
				content: 'import { Exit } from "effect";\nexport const ending = (exit) => (Exit.isSuccess(exit) ? "ended" : "unauthorized");',
				path: "src/test-support/orders.ts",
			},
			{ content: 'import type { Exit } from "effect";\nconst tag: Exit.Exit<void>["_tag"] = "Success";', path: "src/orders.typecheck.spec.ts" },
			{ content: 'import { Exit } from "effect";\nexpect(Exit.isSuccess(Exit.void)).toBe(true);', path: "src/ending.unit.spec.ts" },
		),
	],
	function* ({ checks }) {
		expect(yield* checks(domainOutcomes)).toEqual([]);
	},
);

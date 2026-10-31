import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { namedValues } from "#rules/stories/namedValues.ts";
import { storySpecs } from "#rules/stories/specs.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const SPEC = "src/orders.spec.ts";

const STATUS_NAMES = 'import * as HttpStatus from "effect/http/HttpStatus" and use HttpStatus.fromLiteral("NotFound")';

for (const assertion of [
	"expect(response.status).toBe(404);",
	'expect.soft((response["status"])).not.toBe((+500));',
	"expect(statuses).toHaveLength(1);",
]) {
	ruleStory.it(
		`tests/named-values reports ${assertion} in a spec and points to Effect's HttpStatus names`,
		[repositoryHas({ content: assertion, path: SPEC })],
		function* ({ check, locations, messages }) {
			yield* check(namedValues);

			yield* outcomes({
				"advice": [messages(), [expect.stringContaining(STATUS_NAMES)]],
				"locations": [locations(), [`${SPEC}:1`]],
			});
		},
	);
}

for (const assertion of ["expect(exitCode).toBe(1);", 'expect.soft(process["exitCode"]).not.toBe(-1);']) {
	ruleStory.it(
		`tests/named-values accepts the process exit code literal in ${assertion}`,
		[repositoryHas({ content: assertion, path: SPEC })],
		function* ({ check }) {
			expect(yield* check(namedValues)).toEqual([]);
		},
	);
}

for (const [route, files] of [
	["directly", [{ content: 'import * as HttpStatus from "effect/http/HttpStatus";', path: "src/orders.unit.test.ts" }]],
	[
		"through a test-support module",
		[
			{ content: 'export * as HttpStatus from "effect/http/HttpStatus";', path: "src/test-support/status.ts" },
			{ content: 'import { HttpStatus } from "./test-support/status.ts";', path: "src/orders.unit.test.ts" },
		],
	],
] as const) {
	ruleStory.it(`tests/story-specs lets a unit test import Effect's HttpStatus names ${route}`, [repositoryHas(...files)], function* ({ check }) {
		expect(yield* check(storySpecs)).toEqual([]);
	});
}

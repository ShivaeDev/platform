import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { noDoubleCast } from "#rules/suppressions/noDoubleCast.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

for (const [expression, bridge] of [
	["value as unknown as Target", "unknown"],
	["value as any as Target", "any"],
	["value as never as Target", "never"],
	["(value as unknown) as Target", "unknown"],
	["<Target>(<unknown>value)", "unknown"],
	["<Target>(value as any)", "any"],
	["(<unknown>value) as Target", "unknown"],
] as const) {
	ruleStory.it(
		`suppressions/no-double-cast reports ${expression} as a cast through ${bridge}, at its line`,
		[repositoryHas({ content: `declare const value: string;\nexport const a = ${expression};\n`, path: "src/a.ts" })],
		function* ({ check, locations, messages }) {
			yield* check(noDoubleCast);

			yield* outcomes({
				locations: [locations(), ["src/a.ts:2"]],
				messages: [messages(), [`Casts through "${bridge}" to reach a type the value does not have.`]],
			});
		},
	);
}

ruleStory.it(
	"suppressions/no-double-cast reports each double cast of a chain at the line it starts",
	[
		repositoryHas({
			content: "declare const value: string;\nexport const a = (\n\tvalue as unknown as First\n) as unknown as Second;\n",
			path: "src/a.ts",
		}),
	],
	function* ({ check, locations }) {
		yield* check(noDoubleCast);

		expect(yield* locations()).toEqual(["src/a.ts:2", "src/a.ts:3"]);
	},
);

for (const expression of [
	"value as unknown",
	"value as Target",
	"value as const",
	"value as Wide as Narrow",
	"(value as unknown) satisfies unknown",
]) {
	ruleStory.it(
		`suppressions/no-double-cast accepts ${expression}`,
		[repositoryHas({ content: `declare const value: string;\nexport const a = ${expression};\n`, path: "src/a.ts" })],
		function* ({ check }) {
			expect(yield* check(noDoubleCast)).toEqual([]);
		},
	);
}

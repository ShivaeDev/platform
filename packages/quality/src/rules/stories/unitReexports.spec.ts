import { storySpecs } from "#rules/stories/specs.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { ordersPackage, unitSpec } from "#test/unitFiles.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";
import { PURE_REPAIR } from "#units/runtime.ts";

ruleStory.it(
	"tests/story-specs traces named runner re-exports to the terminal value instead of stopping at an alias binding",
	[
		repositoryHas(
			ordersPackage,
			{ content: 'export { execute as run } from "./terminal.ts";', path: "src/helpers.ts" },
			{ content: 'import { Effect } from "effect";\nexport const execute = Effect.runPromise;', path: "src/terminal.ts" },
			unitSpec('import { run } from "./helpers.ts";\nrun(program);'),
		),
	],
	function* ({ check }) {
		const findings = yield* check(storySpecs);

		yield* assertThat(findings, (actual) =>
			actual.toEqual([
				{
					file: "src/orders.unit.test.ts",
					line: 1,
					message: `This \`.unit\` test reaches \`Effect.runPromise\` through \`src/helpers.ts -> src/terminal.ts:2\`. ${PURE_REPAIR}`,
				},
			]),
		);
	},
);

import { assertThat } from "@shivaedev/test-kits/quality/adapters/assertThat.ts";
import { maxDepth } from "#rules/maxDepth.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const MESSAGE = "Indentation is 8+ tabs deep. Extract a named function or component.";

ruleStory.it(
	"nesting/max-depth reports each line indented with eight or more tabs at its line",
	[repositoryHas({ content: `ok\n${"\t".repeat(8)}value\n${"\t".repeat(9)}deeper\n`, path: "src/deep.ts" })],
	function* ({ check }) {
		const findings = yield* check(maxDepth);

		yield* assertThat(findings, (actual) =>
			actual.toEqual([
				{ file: "src/deep.ts", line: 2, message: MESSAGE },
				{ file: "src/deep.ts", line: 3, message: MESSAGE },
			]),
		);
	},
);

ruleStory.it(
	"nesting/max-depth accepts a line indented with seven tabs",
	[repositoryHas({ content: `${"\t".repeat(7)}value\n`, path: "src/shallow.tsx" })],
	function* ({ check }) {
		yield* assertThat(yield* check(maxDepth), (actual) => actual.toEqual([]));
	},
);

for (const extension of ["ts", "mts", "cts"]) {
	ruleStory.it(
		`nesting/max-depth ignores eight tabs in a .d.${extension} declaration file`,
		[repositoryHas({ content: `${"\t".repeat(8)}value\n`, path: `src/types.d.${extension}` })],
		function* ({ check }) {
			yield* assertThat(yield* check(maxDepth), (actual) => actual.toEqual([]));
		},
	);
}

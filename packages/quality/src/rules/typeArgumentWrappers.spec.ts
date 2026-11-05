import { assertThat } from "@shivaedev/test-kits/quality/adapters/assertThat.ts";
import { noBarrel } from "#rules/noBarrel.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

for (const wrapper of [
	"export const columns = () => createColumnHelper<Feature>();",
	"export function columns() { return createColumnHelper<Feature>(); }",
	"export const columns = function () { return createColumnHelper<Feature>(); };",
	"export const columns = (options: Options) => createColumnHelper<Feature>(options);",
]) {
	ruleStory.it(
		`structure/no-barrel accepts a wrapper that supplies a type argument: ${wrapper}`,
		[repositoryHas({ content: `import { createColumnHelper } from "library";\n${wrapper}`, path: "src/columns.ts" })],
		function* ({ check }) {
			const findings = yield* check(noBarrel);

			yield* assertThat(findings, (actual) => actual.toEqual([]));
		},
	);
}

ruleStory.it(
	"structure/no-barrel still reports an unchanged column-helper forwarding call",
	[
		repositoryHas({
			content: 'import { createColumnHelper } from "library";\nexport const columns = () => createColumnHelper();',
			path: "src/columns.ts",
		}),
	],
	function* ({ check }) {
		const findings = yield* check(noBarrel);

		yield* assertThat(findings, (actual, expect) =>
			actual.toEqual([expect.objectContaining({ file: "src/columns.ts", line: 2, message: expect.stringContaining('"library"') })]),
		);
	},
);

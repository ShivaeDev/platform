import { expect } from "vitest";
import { unusedCode } from "#rules/unusedCode.ts";
import { ruleStory } from "#test/ruleStory.ts";
import { unusedApplication } from "#test/unusedApplication.ts";

ruleStory.it(
	"code/unused accepts folder migrations, shadcn imports, CSS dependencies, peers and test support in a plain app",
	unusedApplication(),
	function* ({ check, findings }) {
		yield* check(unusedCode);

		expect(yield* findings()).toEqual([]);
	},
);

ruleStory.it("code/unused still reports an unused file and dependency in the plain app", unusedApplication(true), function* ({ check, findings }) {
	yield* check(unusedCode);

	expect((yield* findings()).map(({ file, subject }) => ({ file, subject }))).toEqual([
		{ file: "src/abandoned.ts", subject: "files:src/abandoned.ts" },
		{ file: "package.json", subject: "dependencies:unused-tool" },
	]);
});

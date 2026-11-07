import { unusedCode } from "#rules/unusedCode.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

const fixture = [
	{ content: '{"name":"app","type":"module","scripts":{"benchmark":"node script/benchmark.ts"}}', path: "package.json" },
	{ content: '{"include":["script"]}', path: "tsconfig.json" },
	{
		content:
			'import { spawn } from "node:child_process"; import { join } from "node:path"; const root = process.env.CHECKOUT_ROOT ?? process.cwd(); const ENGINE_DIR = "script/perf"; spawn(process.execPath, [join(root, ENGINE_DIR, "driver.ts")]);',
		path: "script/benchmark.ts",
	},
	{ content: 'import { run } from "./helper.ts"; console.log(run); export const unusedExport = 1;', path: "script/perf/driver.ts" },
	{ content: "export const run = 1;", path: "script/perf/helper.ts" },
];

ruleStory.it("code/unused reports files reached only through a runtime-built driver path", [repositoryHas(...fixture)], function* ({ check }) {
	const result = yield* check(unusedCode);

	yield* assertThat(
		result.map(({ file, subject }) => ({ file, subject })),
		(actual) =>
			actual.toEqual([
				{ file: "script/perf/driver.ts", subject: "files:script/perf/driver.ts" },
				{ file: "script/perf/helper.ts", subject: "files:script/perf/helper.ts" },
			]),
	);
});

ruleStory.it("code/unused accepts declared runtime-built entries and still checks their exports", [repositoryHas(...fixture)], function* ({ check }) {
	const findings = yield* check(unusedCode, undefined, ".", ["script/perf/driver.ts"]);

	yield* assertThat(
		findings.map(({ file, subject }) => ({ file, subject })),
		(actual) => actual.toEqual([{ file: "script/perf/driver.ts", subject: "exports:unusedExport" }]),
	);
});

ruleStory.it(
	"code/unused rejects a declared entry pattern that matches no file and names it",
	[repositoryHas(...fixture)],
	function* ({ checkOutcome, failureMessage }) {
		const outcome = yield* checkOutcome(unusedCode, ["script/missing.ts"]);

		yield* assertThat(outcome, (actual) => actual.toBe("failed"));
		yield* assertThat(yield* failureMessage(), (actual) => actual.toContain('entries pattern "script/missing.ts" matched no files'));
	},
);

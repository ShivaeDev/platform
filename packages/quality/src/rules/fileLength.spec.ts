import { maxLines } from "#rules/maxLines.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";
import { lines } from "#testing/adapters/tree.ts";

ruleStory.it(
	"structure/max-lines reports a source file over 150 lines with the number of lines over the limit",
	[repositoryHas({ content: lines(168), path: "src/big.ts" })],
	function* ({ check }) {
		const findings = yield* check(maxLines);

		yield* assertThat(findings, (actual) =>
			actual.toEqual([{ count: 18, file: "src/big.ts", message: "168 lines exceeds the 150-line limit.", threshold: 150 }]),
		);
	},
);

for (const path of [
	"src/a.test.ts",
	"src/b.spec.tsx",
	"tests/e2e.spec.ts",
	"packages/x/src/test-support/harness.ts",
	"src/test-support/fixtures/tree.ts",
]) {
	ruleStory.it(
		`structure/max-lines holds the test code ${path} to 300 lines`,
		[repositoryHas({ content: lines(301), path })],
		function* ({ check, messages }) {
			yield* check(maxLines);

			yield* assertThat(yield* messages(), (actual) => actual.toEqual(["301 lines exceeds the 300-line limit."]));
		},
	);
}

for (const path of ["e2e/flow.ts", "test/support.ts"]) {
	ruleStory.it(
		`structure/max-lines holds the helper ${path} outside a test-support folder to 150 lines`,
		[repositoryHas({ content: lines(151), path })],
		function* ({ check, messages }) {
			yield* check(maxLines);

			yield* assertThat(yield* messages(), (actual) => actual.toEqual(["151 lines exceeds the 150-line limit."]));
		},
	);
}

const atLimit = [
	["a source file of exactly 150 lines", "src/full.ts", 150],
	["a test file of exactly 300 lines", "src/full.test.ts", 300],
] as const;

for (const [file, path, count] of atLimit) {
	ruleStory.it(
		`structure/max-lines accepts ${file}, each ending in a newline`,
		[repositoryHas({ content: lines(count), path })],
		function* ({ check }) {
			yield* assertThat(yield* check(maxLines), (actual) => actual.toEqual([]));
		},
	);
}

ruleStory.it(
	"structure/max-lines counts a last line without a newline",
	[repositoryHas({ content: "a\nb\nc", path: "src/a.ts" })],
	function* ({ check, messages }) {
		yield* check(maxLines, { source: 2 });

		yield* assertThat(yield* messages(), (actual) => actual.toEqual(["3 lines exceeds the 2-line limit."]));
	},
);

ruleStory.it(
	"structure/max-lines applies the configured source and test limits",
	[repositoryHas({ content: lines(101), path: "src/a.ts" }, { content: lines(121), path: "src/a.test.ts" })],
	function* ({ check, messages }) {
		yield* check(maxLines, { source: 100, test: 120 });

		yield* assertThat(yield* messages(), (actual) =>
			actual.toEqual(["121 lines exceeds the 120-line limit.", "101 lines exceeds the 100-line limit."]),
		);
	},
);

for (const path of ["src/contract.d.ts", "src/module.d.mts", "src/common.d.cts"]) {
	ruleStory.it(
		`structure/max-lines leaves the declaration file ${path} alone`,
		[repositoryHas({ content: lines(400), path })],
		function* ({ check }) {
			yield* assertThat(yield* check(maxLines), (actual) => actual.toEqual([]));
		},
	);
}

const refused = [
	["the misspelled option sourc", { sourc: 100 }, "sourc"],
	["custom test patterns", { testFiles: ["src/**"] }, "testFiles"],
	["a source limit of 0", { source: 0 }, "source"],
	["a fractional test limit", { test: 1.5 }, "test"],
	["a source limit above the shared 150", { source: 151 }, "source"],
	["a test limit above the shared 300", { test: 301 }, "test"],
] as const;

for (const [options, given, named] of refused) {
	ruleStory.it(`structure/max-lines refuses ${options} and names it`, [], function* ({ optionIssues }) {
		yield* assertThat(yield* optionIssues(maxLines, given), (actual, expect) => actual.toEqual([expect.stringContaining(named)]));
	});
}

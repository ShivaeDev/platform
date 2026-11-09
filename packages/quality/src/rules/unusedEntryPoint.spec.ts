import { unusedCode } from "#rules/unusedCode.ts";
import { ruleStory } from "#test/ruleStory.ts";
import { unusedShellEntryPoint, unusedTestStoryEntryPoint } from "#test/unusedEntryPoint.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

for (const abandoned of [false, true]) {
	ruleStory.it(
		`code/unused follows the app's imports through the platform shell and accepts every piece the shell delivers${abandoned ? ", still reporting an abandoned file that imports one" : ""}`,
		[unusedShellEntryPoint(abandoned)],
		function* ({ check }) {
			const findings = yield* check(unusedCode);

			yield* assertThat(
				findings.map(({ file, subject }) => ({ file, subject })),
				(actual) => actual.toEqual(abandoned ? [{ file: "apps/app/src/abandoned.ts", subject: "files:apps/app/src/abandoned.ts" }] : []),
			);
		},
	);

	ruleStory.it(
		`code/unused follows the app's tooling imports through test-story and keeps its unused pieces visible${abandoned ? " when an abandoned file imports them" : ""}`,
		[unusedTestStoryEntryPoint(abandoned)],
		function* ({ check }) {
			const findings = yield* check(unusedCode);

			yield* assertThat(
				findings.map(({ file, subject }) => ({ file, subject })),
				(actual) =>
					actual.toEqual([
						...(abandoned ? [{ file: "apps/app/scripts/abandoned.ts", subject: "files:apps/app/scripts/abandoned.ts" }] : []),
						{ file: "packages/test-story/package.json", subject: "dependencies:@shivaedev/unused-piece" },
					]),
			);
		},
	);
}

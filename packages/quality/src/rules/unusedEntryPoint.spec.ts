import { expect } from "vitest";
import { unusedCode } from "#rules/unusedCode.ts";
import { ruleStory } from "#test/ruleStory.ts";
import { unusedEntryPoint } from "#test/unusedEntryPoint.ts";

for (const abandoned of [false, true]) {
	ruleStory.it(
		`code/unused follows the app's entry-point dependency and keeps unused pieces visible${abandoned ? " when an abandoned file imports them" : ""}`,
		[unusedEntryPoint(abandoned)],
		function* ({ check }) {
			const findings = yield* check(unusedCode);

			expect(findings.filter(({ subject }) => subject?.startsWith("dependencies:")).map(({ file, subject }) => ({ file, subject }))).toEqual([
				{ file: "packages/platform/package.json", subject: "dependencies:@shivaedev/unused-piece" },
			]);
		},
	);
}

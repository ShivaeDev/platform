import { unusedCode } from "#rules/unusedCode.ts";
import { BUILD_SHAPES, programmaticBuild } from "#test/programmaticBuild.ts";
import { ruleStory } from "#test/ruleStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

for (const [shape, content] of BUILD_SHAPES) {
	ruleStory.it(`code/unused follows ${shape} and keeps the abandoned file visible`, [programmaticBuild(content)], function* ({ check }) {
		const findings = yield* check(unusedCode);

		yield* assertThat(
			findings.filter(({ subject }) => subject?.startsWith("files:")).map(({ file }) => file),
			(actual) => actual.toEqual(["src/abandoned.ts"]),
		);
	});
}

import { namedAfterExport } from "#rules/files/namedAfterExport.ts";
import { BUILD_SHAPES, programmaticBuild } from "#test/programmaticBuild.ts";
import { ruleStory } from "#test/ruleStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

for (const [shape, content] of BUILD_SHAPES) {
	ruleStory.it(`files/named-after-export accepts the entry named by ${shape}`, [programmaticBuild(content)], function* ({ check }) {
		yield* assertThat(yield* check(namedAfterExport), (actual) => actual.toEqual([]));
	});
}

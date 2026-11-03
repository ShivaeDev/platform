import { biomeStory } from "#test/biomeStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

biomeStory.it(
	"Biome's recommended preset lists suspicious/noDebugger, which it enables, and not style/useBlockStatements, which it leaves off",
	[],
	function* ({ listsRecommendedRules }) {
		const rules = yield* listsRecommendedRules();

		yield* assertThat(
			rules.filter((rule) => rule === "suspicious/noDebugger" || rule === "style/useBlockStatements"),
			(actual) => actual.toEqual(["suspicious/noDebugger"]),
		);
	},
);

import { biomeStory } from "#test/biomeStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

biomeStory.it(
	"Quality's shipped preset runs every rule Biome recommends at error, apart from the rules its declarations weaken",
	[],
	function* ({ presetBelowError }) {
		yield* assertThat(yield* presetBelowError(), (actual) => actual.toEqual([]));
	},
);

biomeStory.it(
	"a rule a Biome upgrade adds to its recommended preset fails until the shipped preset sets it to error",
	[],
	function* ({ presetBelowError }) {
		yield* assertThat(yield* presetBelowError("suspicious/noRuleFromAnUpgrade"), (actual) =>
			actual.toEqual(["suspicious/noRuleFromAnUpgrade: Biome's default level"]),
		);
	},
);

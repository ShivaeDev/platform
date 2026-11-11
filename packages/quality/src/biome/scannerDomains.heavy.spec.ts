import { SCANNER_RULES } from "#biome/scannerRules.ts";
import { biomeStory } from "#test/biomeStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

// Biome explains one rule per process, so this asks it about each of its several hundred rules.
biomeStory.it(
	"the rules a fast run turns off for want of Biome's project scanner are exactly the installed Biome's project and types rules",
	[],
	function* ({ listsScannerRules }) {
		const rules = yield* listsScannerRules();

		yield* assertThat(
			[...SCANNER_RULES].toSorted((left, right) => left.localeCompare(right)),
			(actual) => actual.toEqual(rules.toSorted((left, right) => left.localeCompare(right))),
		);
	},
);

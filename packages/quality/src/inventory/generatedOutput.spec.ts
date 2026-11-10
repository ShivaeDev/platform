import { generatedLayout, generatorWrote, titleLimitExported } from "#test/generatedOutput.ts";
import { biomeFormatted, committed, qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

const LAYOUT = [qualityInstalled(), repositoryHas(...generatedLayout), biomeFormatted()];

repositoryStory.it(
	"quality lint passes when a tracked module and client import unformatted generated output that git ignores",
	[...LAYOUT, generatorWrote("TitleTaken"), committed()],
	function* ({ outcome, runs }) {
		yield* runs("lint");

		yield* assertThat(yield* outcome(), (actual) => actual.toBe("passed"));
	},
);

repositoryStory.it(
	"quality lint passes when a tracked module and client import generated output that a fresh checkout lacks beside its tracked README",
	[...LAYOUT, committed()],
	function* ({ outcome, runs }) {
		yield* runs("lint");

		yield* assertThat(yield* outcome(), (actual) => actual.toBe("passed"));
	},
);

repositoryStory.it(
	"quality lint counts an export that only generated output imports as used",
	[...LAYOUT, repositoryHas(titleLimitExported), generatorWrote("MAX_TITLE_LENGTH", "TitleTaken"), committed()],
	function* ({ outcome, runs }) {
		yield* runs("lint");

		yield* assertThat(yield* outcome(), (actual) => actual.toBe("passed"));
	},
);

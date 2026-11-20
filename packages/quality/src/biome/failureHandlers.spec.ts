import { biomeStory, presetInstalled, repositoryHas } from "#test/biomeStory.ts";
import { FAILURE_HANDLERS } from "#test/nestedComponentFiles.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

biomeStory.it(
	"Biome under Quality's preset reports nothing for failure handlers keyed by an error tag in a component and a custom hook",
	[presetInstalled(), repositoryHas(FAILURE_HANDLERS)],
	function* ({ checks, reportedIn }) {
		yield* checks();

		yield* assertThat(yield* reportedIn(FAILURE_HANDLERS.path), (actual) => actual.toEqual([]));
	},
);

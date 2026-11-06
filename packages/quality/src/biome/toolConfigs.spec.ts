import { biomeStory, presetInstalled, repositoryHas } from "#test/biomeStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

biomeStory.it(
	"Biome accepts a tool-required default export in dependency-cruiser configs and still rejects ordinary defaults",
	[
		presetInstalled(),
		repositoryHas(
			{ content: "export default {};\n", path: ".dependency-cruiser.ts" },
			{ content: "export default {};\n", path: "apps/desktop/.dependency-cruiser.ts" },
			{ content: "export default {};\n", path: "src/dependency-cruiser.ts" },
		),
	],
	function* ({ checks, reported }) {
		yield* checks();

		yield* assertThat(yield* reported("lint/style/noDefaultExport"), (actual) => actual.toEqual(["src/dependency-cruiser.ts:1"]));
	},
);

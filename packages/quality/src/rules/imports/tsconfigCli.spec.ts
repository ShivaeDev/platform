import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { biomeFormatted, qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";
import { withMatchers } from "#testing/adapters/assertThat.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";

repositoryStory.it(
	"quality lint rejects an invalid tsconfig with an import finding that names its compiler diagnostic and repair",
	[
		qualityInstalled(),
		repositoryHas(
			{ content: '{"compilerOptions":{"moduleResolution":"sideways"}}', path: "tsconfig.json" },
			{ content: "export const value = 1;", path: "src/value.ts" },
		),
		biomeFormatted(),
	],
	function* ({ runs, outcome, stdout }) {
		yield* runs("lint");

		yield* withMatchers((expect) =>
			outcomes([
				["exit", () => outcome(), "rejected"],
				["import finding", () => stdout(), expect.stringContaining("error imports/resolvable (1)")],
				["compiler diagnostic", () => stdout(), expect.stringMatching(/tsconfig\.json:\d+\s+TS6046/u)],
				["repair", () => stdout(), expect.stringContaining("Repair the tsconfig before trusting import findings.")],
			]),
		);
	},
	CLI_TIMEOUT,
);

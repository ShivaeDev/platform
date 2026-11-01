import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { CLI_TIMEOUT } from "#test/cli.ts";
import { biomeFormatted, qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";

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

		yield* outcomes([
			["exit", () => outcome(), "rejected"],
			["import finding", () => stdout(), expect.stringContaining("error imports/resolvable (1)")],
			["compiler diagnostic", () => stdout(), expect.stringMatching(/tsconfig\.json:\d+\s+TS6046/u)],
			["repair", () => stdout(), expect.stringContaining("Repair the tsconfig before trusting import findings.")],
		]);
	},
	CLI_TIMEOUT,
);

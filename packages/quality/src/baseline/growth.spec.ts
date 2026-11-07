import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { baselineStory } from "#test/baselineStory.ts";
import { debtRecorded, lengthened } from "#test/debtRecorded.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";

const HINT = "For moved files, carry their existing debt with `quality baseline prune --against <base>`.";

baselineStory.it(
	"lint rejects growing debt and ends with prune guidance for moved files",
	[debtRecorded(), lengthened("src/longer.ts", 7)],
	function* ({ lastLine, outcome, runs }) {
		yield* runs("lint");

		yield* outcomes([
			["exit", () => outcome(), "rejected"],
			["report's last line", () => lastLine(), HINT],
		]);
	},
	CLI_TIMEOUT,
);

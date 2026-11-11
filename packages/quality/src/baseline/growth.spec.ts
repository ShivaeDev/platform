import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { baselineStory } from "#test/baselineStory.ts";
import { debtRecorded, lengthened } from "#test/debtRecorded.ts";
import { FAST_RUN } from "#test/runs.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";

const HINT = "For moved files, carry their existing debt with `quality baseline prune --against <base>`.";

baselineStory.it(
	"lint rejects growing debt and gives prune guidance for moved files just before the line that names its rule set",
	[debtRecorded(), lengthened("src/longer.ts", 7)],
	function* ({ closingSections, outcome, runs }) {
		yield* runs("lint");

		yield* outcomes([
			["exit", () => outcome(), "rejected"],
			["report's closing sections", () => closingSections(2), [HINT, FAST_RUN]],
		]);
	},
	CLI_TIMEOUT,
);

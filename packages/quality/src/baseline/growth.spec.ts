import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { baselineStory } from "#test/baselineStory.ts";
import { CLI_TIMEOUT } from "#test/cli.ts";
import { added, branchedFromMain, debtRecorded, lengthened, staged } from "#test/debtRecorded.ts";

const HINT = "For moved files, carry their existing debt with `quality baseline prune --against <base>`.";
const RECORDED = ["src/long.ts structure/max-lines 1", "src/longer.ts structure/max-lines 3"];

baselineStory.it(
	"lint rejects growing debt and ends with prune guidance for moved files",
	[debtRecorded(), lengthened("src/longer.ts", 7)],
	function* ({ lastLine, outcome, runs }) {
		yield* runs("lint");

		yield* outcomes({ "exit": [outcome(), "rejected"], "report's last line": [lastLine(), HINT] });
	},
	CLI_TIMEOUT,
);

baselineStory.it(
	"baseline write records only the selected changed file and preserves other entries",
	[debtRecorded(), branchedFromMain(), added("src/new.ts", 5), staged("src/new.ts"), lengthened("src/longer.ts", 7)],
	function* ({ outcome, recorded, runs }) {
		yield* runs("baseline", "write", "--rule", "structure/max-lines", "--file", "src/new.ts");

		yield* outcomes({
			"exit": [outcome(), "passed"],
			"recorded debt": [recorded(), [...RECORDED, "src/new.ts structure/max-lines 2"]],
		});
	},
	CLI_TIMEOUT,
);

baselineStory.it(
	"baseline write refuses a file outside the current change set without changing any entry",
	[debtRecorded(), branchedFromMain(), lengthened("src/longer.ts", 7)],
	function* ({ outcome, recorded, runs, stderr }) {
		yield* runs("baseline", "write", "--rule", "structure/max-lines", "--file", "src/long.ts", "--file", "src/longer.ts");

		yield* outcomes({
			"exit": [outcome(), "invalid"],
			"reason": [stderr(), expect.stringContaining("outside the current change set: src/long.ts")],
			"recorded debt": [recorded(), RECORDED],
		});
	},
	CLI_TIMEOUT,
);

baselineStory.it(
	"baseline write refuses to record a rule repo-wide once a baseline exists",
	[debtRecorded(), branchedFromMain(), lengthened("src/longer.ts", 7)],
	function* ({ outcome, recorded, runs, stderr }) {
		yield* runs("baseline", "write", "--rule", "structure/max-lines");

		yield* outcomes({
			"exit": [outcome(), "invalid"],
			"reason": [stderr(), expect.stringContaining("--file <path>")],
			"recorded debt": [recorded(), RECORDED],
		});
	},
	CLI_TIMEOUT,
);

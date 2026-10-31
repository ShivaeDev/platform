import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { baselineStory } from "#test/baselineStory.ts";
import { CLI_TIMEOUT } from "#test/cli.ts";
import { added, debtRecorded, lengthened, renamed } from "#test/debtRecorded.ts";

const HINT =
	"If the baseline should keep these findings, such as the debt of a moved or renamed file, record them again with `quality baseline write --rule structure/max-lines` and call out the baseline growth in the pull request description.";

baselineStory.it(
	"lint rejects a file that grew past its baselined count and ends its report with the command that records structure/max-lines again",
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

baselineStory.it(
	"baseline write --rule structure/max-lines records a new file's debt beside the existing entries, after which lint passes",
	[debtRecorded(), added("src/new.ts", 5)],
	function* ({ lint, recorded, runs }) {
		expect(yield* lint()).toBe("rejected");

		yield* runs("baseline", "write", "--rule", "structure/max-lines");

		yield* outcomes([
			["lint", () => lint(), "passed"],
			[
				"recorded debt",
				() => recorded(),
				["src/long.ts structure/max-lines 1", "src/longer.ts structure/max-lines 3", "src/new.ts structure/max-lines 2"],
			],
		]);
	},
	CLI_TIMEOUT,
);

baselineStory.it(
	"baseline write --rule structure/max-lines after a rename records the debt under the new path and drops the old path's entry",
	[debtRecorded(), renamed("src/longer.ts", "src/renamed.ts")],
	function* ({ recorded, runs }) {
		expect(yield* recorded()).toEqual(["src/long.ts structure/max-lines 1", "src/longer.ts structure/max-lines 3"]);

		yield* runs("baseline", "write", "--rule", "structure/max-lines");

		expect(yield* recorded()).toEqual(["src/long.ts structure/max-lines 1", "src/renamed.ts structure/max-lines 3"]);
	},
	CLI_TIMEOUT,
);

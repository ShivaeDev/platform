import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { baselineStory } from "#test/baselineStory.ts";
import { CLI_TIMEOUT } from "#test/cli.ts";
import { branchedFromMain, debtRecorded, moveCommitted, shortened } from "#test/debtRecorded.ts";
import { remoteBranches, shallowClone, unrelatedHistory } from "#test/remoteBranches.ts";

const RECORDED = ["src/long.ts structure/max-lines 1", "src/longer.ts structure/max-lines 3"];

const CARRIED = ["src/a-longer.ts structure/max-lines 3", "src/long.ts structure/max-lines 1"];

const DEFAULT_BRANCHES = [
	{ case: "origin/master when it is the only default branch", remote: remoteBranches({ "origin/master": "main" }) },
	{ case: "origin/main before origin/master", remote: remoteBranches({ "origin/main": "main", "origin/master": "work" }) },
	{ case: "origin/HEAD before origin/main", remote: remoteBranches({ "origin/main": "work", "origin/trunk": "main" }, "origin/trunk") },
];

for (const { case: chosen, remote } of DEFAULT_BRANCHES) {
	baselineStory.it(
		`baseline prune carries a moved file's debt from the merge base with ${chosen}`,
		[debtRecorded(), branchedFromMain(), moveCommitted("src/longer.ts", "src/a-longer.ts"), remote],
		function* ({ recorded, runs }) {
			expect(yield* recorded()).toEqual(RECORDED);

			yield* runs("baseline", "prune");

			expect(yield* recorded()).toEqual(CARRIED);
		},
		CLI_TIMEOUT,
	);
}

baselineStory.it(
	"baseline prune --against main carries a file moved since the merge base to its new path and reports the carried entry",
	[debtRecorded(), branchedFromMain(), moveCommitted("src/longer.ts", "src/a-longer.ts")],
	function* ({ recorded, runs, stdout }) {
		expect(yield* recorded()).toEqual(RECORDED);

		yield* runs("baseline", "prune", "--against", "main");

		yield* outcomes({
			"recorded debt": [recorded(), CARRIED],
			"report": [stdout(), "quality: removed 0 entries, lowered 0 entries and carried 1 entry to moved files in quality-baseline.jsonl.\n"],
		});
	},
	CLI_TIMEOUT,
);

baselineStory.it(
	"baseline prune without a default branch drops a moved file's debt, passes and says it cannot find the default branch",
	[debtRecorded(), branchedFromMain(), moveCommitted("src/longer.ts", "src/a-longer.ts")],
	function* ({ outcome, recorded, runs, stderr }) {
		yield* runs("baseline", "prune");

		yield* outcomes({
			"exit": [outcome(), "passed"],
			"recorded debt": [recorded(), ["src/long.ts structure/max-lines 1"]],
			"warning": [stderr(), expect.stringContaining("quality: moved files are not followed: cannot find the default branch")],
		});
	},
	CLI_TIMEOUT,
);

baselineStory.it(
	"baseline prune outside git removes fixed debt, passes and says that moves are not followed",
	[debtRecorded(), shortened("src/long.ts", 1)],
	function* ({ outcome, runs, stderr, stdout }) {
		yield* runs("baseline", "prune");

		yield* outcomes({
			"exit": [outcome(), "passed"],
			"report": [stdout(), "quality: removed 1 entry and lowered 0 entries in quality-baseline.jsonl.\n"],
			"warning": [stderr(), expect.stringContaining("quality: moved files are not followed:")],
		});
	},
	CLI_TIMEOUT,
);

baselineStory.it(
	"baseline prune --against a ref that names no commit is invalid and names the ref",
	[debtRecorded(), branchedFromMain(), moveCommitted("src/longer.ts", "src/a-longer.ts")],
	function* ({ outcome, runs, stderr }) {
		yield* runs("baseline", "prune", "--against", "origin/missing");

		yield* outcomes({
			"error": [stderr(), expect.stringContaining("origin/missing names no commit")],
			"exit": [outcome(), "invalid"],
		});
	},
	CLI_TIMEOUT,
);

baselineStory.it(
	"baseline prune --against in a shallow clone that misses the merge base is invalid, says the clone is shallow and leaves it shallow",
	[debtRecorded(), branchedFromMain(), shallowClone()],
	function* ({ outcome, runs, shallow, stderr }) {
		yield* runs("baseline", "prune", "--against", "origin/main");

		yield* outcomes({
			"clone": [shallow(), "shallow"],
			"error": [stderr(), expect.stringContaining("the clone is shallow and does not reach the merge base")],
			"exit": [outcome(), "invalid"],
		});
	},
	CLI_TIMEOUT,
);

baselineStory.it(
	"baseline prune --against a branch that shares no history with HEAD is invalid and says so",
	[debtRecorded(), branchedFromMain(), unrelatedHistory()],
	function* ({ outcome, runs, stderr }) {
		yield* runs("baseline", "prune", "--against", "main");

		yield* outcomes({
			"error": [stderr(), expect.stringContaining("HEAD and main share no history.")],
			"exit": [outcome(), "invalid"],
		});
	},
	CLI_TIMEOUT,
);

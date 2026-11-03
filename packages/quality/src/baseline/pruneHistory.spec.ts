import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { baselineStory } from "#test/baselineStory.ts";
import { branchedFromMain, debtRecorded, moveCommitted } from "#test/debtRecorded.ts";
import { shallowClone, unrelatedHistory } from "#test/remoteBranches.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";

baselineStory.it(
	"baseline prune --against a ref that names no commit is invalid and names the ref",
	[debtRecorded(), branchedFromMain(), moveCommitted("src/longer.ts", "src/a-longer.ts")],
	function* ({ outcome, runs, stderr }) {
		yield* runs("baseline", "prune", "--against", "origin/missing");

		yield* outcomes([
			["error", () => stderr(), expect.stringContaining("origin/missing names no commit")],
			["exit", () => outcome(), "invalid"],
		]);
	},
	CLI_TIMEOUT,
);

baselineStory.it(
	"baseline prune --against in a shallow clone that misses the merge base is invalid, says the clone is shallow and leaves it shallow",
	[debtRecorded(), branchedFromMain(), shallowClone()],
	function* ({ outcome, runs, shallow, stderr }) {
		yield* runs("baseline", "prune", "--against", "origin/main");

		yield* outcomes([
			["clone", () => shallow(), "shallow"],
			["error", () => stderr(), expect.stringContaining("the clone is shallow and does not reach the merge base")],
			["exit", () => outcome(), "invalid"],
		]);
	},
	CLI_TIMEOUT,
);

baselineStory.it(
	"baseline prune --against a branch that shares no history with HEAD is invalid and says so",
	[debtRecorded(), branchedFromMain(), unrelatedHistory()],
	function* ({ outcome, runs, stderr }) {
		yield* runs("baseline", "prune", "--against", "main");

		yield* outcomes([
			["error", () => stderr(), expect.stringContaining("HEAD and main share no history.")],
			["exit", () => outcome(), "invalid"],
		]);
	},
	CLI_TIMEOUT,
);

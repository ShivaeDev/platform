import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { baselineStory } from "#test/baselineStory.ts";
import { movedWithGit, shortened } from "#test/debtRecorded.ts";
import { ALPHA_SHARD, packageWorkspace, shardsRecorded } from "#test/packageWorkspace.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";

const BETA_SHARD = "packages/beta/quality-baseline.jsonl";
const CLEAN_SHARD = "packages/clean/quality-baseline.jsonl";
const ROOT_SHARD = "quality-baseline.jsonl";
const ALPHA_DEBT = [
	"packages/alpha/src/a.ts structure/max-lines 3",
	"packages/alpha/src/b.ts structure/max-lines 3",
	"packages/alpha/src/c.ts structure/max-lines 3",
];
const BETA_DEBT = ["packages/beta/src/b.ts structure/max-lines 3"];

baselineStory.it(
	"baseline tighten removes a repaired file's entry from its package's shard and leaves the other shards as they were",
	[packageWorkspace(), shardsRecorded(), shortened("packages/alpha/src/a.ts", 1)],
	function* ({ reads, recorded, runs }) {
		const beta = yield* reads(BETA_SHARD);
		const root = yield* reads(ROOT_SHARD);
		expect(yield* recorded(ALPHA_SHARD)).toEqual(ALPHA_DEBT);

		yield* runs("baseline", "tighten");

		yield* outcomes([
			["alpha shard", () => recorded(ALPHA_SHARD), ALPHA_DEBT.slice(1)],
			["beta shard", () => reads(BETA_SHARD), beta],
			["root shard", () => reads(ROOT_SHARD), root],
		]);
	},
	CLI_TIMEOUT,
);

baselineStory.it(
	"baseline prune deletes the shard of a package whose debt is all fixed and keeps the other packages' shards",
	[packageWorkspace(), shardsRecorded(), shortened("packages/beta/src/b.ts", 1)],
	function* ({ recorded, runs }) {
		expect(yield* recorded(BETA_SHARD)).toEqual(BETA_DEBT);

		yield* runs("baseline", "prune");

		yield* outcomes([
			["alpha shard", () => recorded(ALPHA_SHARD), ALPHA_DEBT],
			["beta shard", () => recorded(BETA_SHARD), "no baseline file"],
		]);
	},
	CLI_TIMEOUT,
);

baselineStory.it(
	"baseline tighten carries the debt of a file moved with git mv into the destination package's shard",
	[packageWorkspace(), shardsRecorded(), movedWithGit("packages/beta/src/b.ts", "packages/clean/src/b.ts")],
	function* ({ recorded, runs }) {
		expect(yield* recorded(CLEAN_SHARD)).toBe("no baseline file");

		yield* runs("baseline", "tighten");

		yield* outcomes([
			["beta shard", () => recorded(BETA_SHARD), "no baseline file"],
			["clean shard", () => recorded(CLEAN_SHARD), ["packages/clean/src/b.ts structure/max-lines 3"]],
		]);
	},
	CLI_TIMEOUT,
);

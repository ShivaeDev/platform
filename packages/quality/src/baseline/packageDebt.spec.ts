import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { baselineStory } from "#test/baselineStory.ts";
import { CLI_TIMEOUT } from "#test/cli.ts";
import { movedWithGit, repositoryHas, shortened } from "#test/debtRecorded.ts";
import { ALPHA_SHARD, packageWorkspace, shardsRecorded } from "#test/packageWorkspace.ts";

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
	"baseline write records each package's debt in that package's shard and the debt outside packages in the root shard",
	[packageWorkspace()],
	function* ({ recorded, runs }) {
		yield* runs("baseline", "write");

		yield* outcomes([
			["alpha shard", () => recorded(ALPHA_SHARD), ALPHA_DEBT],
			["beta shard", () => recorded(BETA_SHARD), BETA_DEBT],
			["root shard", () => recorded(ROOT_SHARD), ["src/root.ts structure/max-lines 3"]],
		]);
	},
	CLI_TIMEOUT,
);

baselineStory.it(
	"lint honours the debt in a package's shard and rejects a package file that grows past it",
	[packageWorkspace(), shardsRecorded()],
	function* ({ lengthens, lint }) {
		expect(yield* lint()).toBe("passed");

		yield* lengthens("packages/alpha/src/a.ts", 7);

		expect(yield* lint()).toBe("rejected");
	},
	CLI_TIMEOUT,
);

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

baselineStory.it(
	"baseline migrate splits a single JSON Lines baseline into the root and package shards with the same counts and removes it",
	[
		packageWorkspace(),
		repositoryHas({
			content:
				'{"path":"src/root.ts","rule":"structure/max-lines","count":3}\n{"path":"packages/alpha/src/a.ts","rule":"structure/max-lines","count":2}\n',
			path: "quality/baseline.jsonl",
		}),
	],
	function* ({ recorded, runs }) {
		yield* runs("baseline", "migrate", "--from", "quality/baseline.jsonl");

		yield* outcomes([
			["alpha shard", () => recorded(ALPHA_SHARD), ["packages/alpha/src/a.ts structure/max-lines 2"]],
			["beta shard", () => recorded(BETA_SHARD), "no baseline file"],
			["root shard", () => recorded(ROOT_SHARD), ["src/root.ts structure/max-lines 3"]],
			["single baseline", () => recorded("quality/baseline.jsonl"), "no baseline file"],
		]);
	},
	CLI_TIMEOUT,
);

baselineStory.it(
	"lint refuses debt recorded in the root shard for a package file and names the shard it belongs in",
	[packageWorkspace(), repositoryHas({ content: '{"path":"packages/alpha/src/a.ts","rule":"structure/max-lines","count":3}\n', path: ROOT_SHARD })],
	function* ({ outcome, runs, stderr }) {
		yield* runs("lint");

		yield* outcomes([
			["error", () => stderr(), expect.stringContaining("packages/alpha/src/a.ts belongs in packages/alpha/quality-baseline.jsonl")],
			["exit", () => outcome(), "invalid"],
		]);
	},
	CLI_TIMEOUT,
);

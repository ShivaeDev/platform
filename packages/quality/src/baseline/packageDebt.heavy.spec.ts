import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { baselineStory } from "#test/baselineStory.ts";
import { boundaryDebt, typedBoundaryDebt } from "#test/boundaryDebt.ts";
import { debtRecorded, repositoryHas } from "#test/debtRecorded.ts";
import { ALPHA_SHARD, packageWorkspace, shardsRecorded } from "#test/packageWorkspace.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";

const BETA_SHARD = "packages/beta/quality-baseline.jsonl";
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

for (const { debt, given } of [
	{ debt: "each package's line-limit debt in its shard", given: [packageWorkspace(), shardsRecorded()] },
	{ debt: "the line-limit debt of a single-package repository", given: [debtRecorded()] },
	{ debt: "an await finding", given: [boundaryDebt()] },
	{ debt: "a typed boundary finding beside the other findings of its files", given: [typedBoundaryDebt()] },
]) {
	baselineStory.it(
		`baseline write records ${debt} byte for byte as the given that records it without the command`,
		given,
		function* ({ removesShards, runs, shards }) {
			const written = yield* shards();
			yield* removesShards();

			yield* runs("baseline", "write");

			expect(yield* shards()).toEqual(written);
		},
		CLI_TIMEOUT,
	);
}

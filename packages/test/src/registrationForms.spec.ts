import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { vitestRun } from "#test/vitestRun.ts";

const REFUSALS = ["ordinary generator refusal", "ordinary Effect refusal", "table generator refusal", "table Effect refusal"] as const;

vitestRun.it(
	"ordinary and table bodies share their harness context and file Layer and report the same typed refusal in either body form",
	[],
	function* ({ errorNames, lifecycle, outcome, runs }) {
		yield* runs(...REFUSALS);

		for (const name of REFUSALS) {
			yield* outcomes([
				[`${name}'s failure`, () => outcome(name), "failed: the shared worker refused the body"],
				[`${name}'s error name`, () => errorNames(name), ["BodyFailure"]],
			]);
		}
		expect(yield* lifecycle()).toEqual([
			"the shared worker starts",
			...REFUSALS.flatMap((name) => [`${name}: one context`, `${name}: one worker`]),
			"released the shared worker",
		]);
	},
);

vitestRun.it(
	"ordinary and table tests report the same file Layer startup failure without running their bodies",
	[],
	function* ({ errorNames, lifecycle, outcome, runs }) {
		const ordinary = "a test of a worker whose Layer fails to start";
		const table = "a table test of a worker whose Layer fails to start";

		yield* runs(ordinary, table);

		for (const name of [ordinary, table] as const) {
			yield* outcomes([
				[`${name}'s failure`, () => outcome(name), "failed: database connection refused during worker startup"],
				[`${name}'s error name`, () => errorNames(name), ["StartupFailure"]],
			]);
		}
		expect(yield* lifecycle()).toEqual(["released the worker's connection"]);
	},
);

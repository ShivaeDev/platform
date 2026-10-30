import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { schemaKit } from "#test/schema/kit.ts";
import { installed, ran, rolledBackTo, snapshotHeld, stopped } from "#test/schema/traits.ts";

const TWO_VERSIONS_BEHIND = 44;

const Recovered = defineQueue({ name: "recover", queue: { partition: true }, schema: Schema.Struct({ value: Schema.Number }) });

const heldBack = [
	installed("jobs_test"),
	ran("producer", [Recovered], { controller: "none", migrate: false, schema: "jobs_test" }),
	stopped("producer"),
	rolledBackTo("jobs_test", TWO_VERSIONS_BEHIND),
	snapshotHeld,
];

schemaKit.it(
	"an upgrade whose concurrent index build gives up records the new version and leaves that index invalid",
	heldBack,
	function* ({ answered, indexes, installSchema, releaseSnapshot, schemaVersion }) {
		expect(yield* schemaVersion("jobs_test")).toBe(TWO_VERSIONS_BEHIND);

		yield* installSchema("jobs_test");
		yield* releaseSnapshot();

		yield* outcomes({
			"answer": [answered(), expect.stringMatching(/^install failed with /u)],
			"common index": [
				indexes("jobs_test", "^job_common_i13$"),
				[{ index: "jobs_test.job_common_i13", table: "jobs_test.job_common", valid: false }],
			],
			"version": [schemaVersion("jobs_test"), 46],
		});
	},
);

schemaKit.it(
	"installing again after an index build gave up repairs the invalid and missing indexes",
	heldBack,
	function* ({ indexes, installSchema, releaseSnapshot }) {
		yield* installSchema("jobs_test");
		yield* releaseSnapshot();
		expect(yield* indexes("jobs_test", "^job_common_i13$")).toEqual([expect.objectContaining({ valid: false })]);

		yield* installSchema("jobs_test");

		expect(yield* indexes("jobs_test", "i13$")).toEqual([
			{ index: "jobs_test.job_common_i13", table: "jobs_test.job_common", valid: true },
			{ index: "jobs_test.partition_i13", table: "jobs_test.partition", valid: true },
		]);
	},
);

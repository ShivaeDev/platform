import assert from "node:assert/strict";
import { planning } from "#ci/test-support/planning.ts";
import { workflowJobs } from "#ci/test-support/workflowJobs.ts";

const reports = [
	{ shard: { count: 2, index: 1 }, timings: [{ durationMs: 20_000, name: "large" }] },
	{ shard: { count: 2, index: 2 }, timings: [{ durationMs: 5000, name: "small" }] },
];

planning.it(
	"sizes consumer shards to finish with the tests after the build",
	[workflowJobs({ build: 150, "packed consumers (1)": 200, "packed consumers (2)": 160, "tests (1)": 900 })],
	({ mergeConsumers }) => {
		const snapshot = mergeConsumers(reports, 240_000);
		assert.equal(snapshot.shardCount, 4);
		assert.deepEqual(
			snapshot.timings.map((item) => item.name),
			["large", "small"],
		);
	},
);

planning.it(
	"reserves at least a minute for consumers after a slow build",
	[workflowJobs({ build: 230, "packed consumers (1)": 200, "packed consumers (2)": 160 })],
	({ mergeConsumers }) => {
		assert.equal(mergeConsumers(reports, 240_000).shardCount, 6);
	},
);

planning.it("requires build timings before sizing consumer shards", [workflowJobs({ "packed consumers (1)": 200 })], ({ mergeConsumers }) => {
	assert.throws(() => mergeConsumers(reports, 240_000), /build/u);
});

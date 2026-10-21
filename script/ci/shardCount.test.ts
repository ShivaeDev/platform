import assert from "node:assert/strict";
import { planning } from "#ci/test-support/planning.ts";
import { workflowJob } from "#ci/test-support/workflowJob.ts";
import { workflowJobs } from "#ci/test-support/workflowJobs.ts";

planning.it("sizes shards so the summed job wall time fills the target per shard", [], ({ countShards }) => {
	assert.equal(countShards([240_000, 240_000], 240_000), 2);
	assert.equal(countShards([240_000, 240_001], 240_000), 3);
	assert.equal(countShards([240_000, 240_001], 600_000), 1);
	assert.equal(countShards([1000], 240_000), 1);
	assert.equal(
		countShards(
			Array.from({ length: 40 }, () => 240_000),
			240_000,
		),
		32,
	);
	assert.throws(() => countShards([1000], 0), /target/u);
});

planning.it("gives consumer shards what the target leaves after the build, but at least a minute", [], ({ consumerBudget }) => {
	assert.equal(consumerBudget(240_000, 150_000), 90_000);
	assert.equal(consumerBudget(240_000, 200_000), 60_000);
	assert.equal(consumerBudget(240_000, 300_000), 60_000);
});

planning.it(
	"reads every matching job's wall time and ignores the other jobs",
	[workflowJobs({ build: 150, "packed consumers (1)": 900, "tests (1)": 300, "tests (2)": 200 })],
	({ readJobs, readJobResponse }) => {
		assert.deepEqual(readJobs(/^tests \(\d+\)$/u, 2), [300_000, 200_000]);
		assert.deepEqual(readJobs(/^build$/u, 1), [150_000]);
		assert.deepEqual(readJobs(/^packed consumers \(\d+\)$/u, 1), [900_000]);
		assert.throws(() => readJobs(/^tests \(\d+\)$/u, 3), /every/u);
		assert.throws(() => readJobResponse({ jobs: [workflowJob("tests (1)", 300, "failure")] }, /^tests \(\d+\)$/u, 1), /Invalid job/u);
		assert.throws(
			() => readJobResponse({ jobs: [{ ...workflowJob("tests (1)", 300), "completed_at": null }] }, /^tests \(\d+\)$/u, 1),
			/Invalid job/u,
		);
		assert.throws(() => readJobResponse({}, /^build$/u, 1), /Invalid workflow jobs/u);
	},
);

planning.it("reads the target from a repository variable in whole seconds", [], ({ readTarget }) => {
	assert.equal(readTarget("240"), 240_000);
	for (const value of [undefined, "", "0", "-1", "1.5", "four"]) {
		assert.throws(() => readTarget(value), /target seconds/u);
	}
});

import assert from "node:assert/strict";
import { test as it } from "node:test";
import { workflowJobs } from "#ci/test-support/workflowJobs.ts";
import { mergeConsumerTimings } from "./mergeConsumerTimings.ts";

const reports = [
	{ shard: { count: 2, index: 1 }, timings: [{ durationMs: 20_000, name: "large" }] },
	{ shard: { count: 2, index: 2 }, timings: [{ durationMs: 5000, name: "small" }] },
];

it("sizes consumer shards to finish with the tests once the build is done", () => {
	const jobs = workflowJobs({ build: 150, "packed consumers (1)": 200, "packed consumers (2)": 160, "tests (1)": 900 });
	const snapshot = mergeConsumerTimings(reports, { count: 2, jobs, runId: "42", sha: "main-sha", targetMs: 240_000 });
	assert.equal(snapshot.shardCount, 4);
	assert.deepEqual(
		snapshot.timings.map((item) => item.name),
		["large", "small"],
	);
	const slowBuild = workflowJobs({ build: 230, "packed consumers (1)": 200, "packed consumers (2)": 160 });
	assert.equal(mergeConsumerTimings(reports, { count: 2, jobs: slowBuild, runId: "42", sha: "main-sha", targetMs: 240_000 }).shardCount, 6);
	assert.throws(
		() =>
			mergeConsumerTimings(reports, {
				count: 2,
				jobs: workflowJobs({ "packed consumers (1)": 200 }),
				runId: "42",
				sha: "main-sha",
				targetMs: 240_000,
			}),
		/build/u,
	);
});

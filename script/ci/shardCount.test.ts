import assert from "node:assert/strict";
import { test as it } from "node:test";
import { consumerShardMs, jobDurations, shardTargetMs, wallTimeShardCount } from "./shardCount.ts";

function job(name: string, seconds: number, conclusion = "success") {
	return { "completed_at": new Date(seconds * 1000).toISOString(), conclusion, name, "started_at": new Date(0).toISOString() };
}

it("sizes shards so the summed job wall time fills the target per shard", () => {
	assert.equal(wallTimeShardCount([240_000, 240_000], 240_000), 2);
	assert.equal(wallTimeShardCount([240_000, 240_001], 240_000), 3);
	assert.equal(wallTimeShardCount([240_000, 240_001], 600_000), 1);
	assert.equal(wallTimeShardCount([1000], 240_000), 1);
	assert.equal(
		wallTimeShardCount(
			Array.from({ length: 40 }, () => 240_000),
			240_000,
		),
		32,
	);
	assert.throws(() => wallTimeShardCount([1000], 0), /target/u);
});

it("gives consumer shards what the target leaves after the build, but at least a minute", () => {
	assert.equal(consumerShardMs(240_000, 150_000), 90_000);
	assert.equal(consumerShardMs(240_000, 200_000), 60_000);
	assert.equal(consumerShardMs(240_000, 300_000), 60_000);
});

it("reads every matching job's wall time and ignores the other jobs", () => {
	const jobs = { jobs: [job("tests (1)", 300), job("build", 150), job("tests (2)", 200), job("packed consumers (1)", 900)] };
	assert.deepEqual(jobDurations(jobs, /^tests \(\d+\)$/u, 2), [300_000, 200_000]);
	assert.deepEqual(jobDurations(jobs, /^build$/u, 1), [150_000]);
	assert.deepEqual(jobDurations(jobs, /^packed consumers \(\d+\)$/u, 1), [900_000]);
	assert.throws(() => jobDurations(jobs, /^tests \(\d+\)$/u, 3), /every/u);
	assert.throws(() => jobDurations({ jobs: [job("tests (1)", 300, "failure")] }, /^tests \(\d+\)$/u, 1), /Invalid job/u);
	assert.throws(() => jobDurations({ jobs: [{ ...job("tests (1)", 300), "completed_at": null }] }, /^tests \(\d+\)$/u, 1), /Invalid job/u);
	assert.throws(() => jobDurations({}, /^build$/u, 1), /Invalid workflow jobs/u);
});

it("reads the target from a repository variable in whole seconds", () => {
	assert.equal(shardTargetMs("240"), 240_000);
	for (const value of [undefined, "", "0", "-1", "1.5", "four"]) {
		assert.throws(() => shardTargetMs(value), /target seconds/u);
	}
});

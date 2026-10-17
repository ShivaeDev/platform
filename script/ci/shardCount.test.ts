import assert from "node:assert/strict";
import { test as it } from "node:test";
import { measuredShardCount, testJobDurations, wallTimeShardCount } from "./shardCount.ts";

function timings(durations: number[]) {
	return durations.map((durationMs, index) => ({ durationMs, name: String(index) }));
}

function job(name: string, seconds: number, conclusion = "success") {
	return { "completed_at": new Date(seconds * 1000).toISOString(), conclusion, name, "started_at": new Date(0).toISOString() };
}

it("sizes shards so the summed job wall time fills four minutes per shard", () => {
	assert.equal(wallTimeShardCount([240_000, 240_000]), 2);
	assert.equal(wallTimeShardCount([240_000, 240_001]), 3);
	assert.equal(wallTimeShardCount([1000]), 1);
	assert.equal(wallTimeShardCount(Array.from({ length: 40 }, () => 240_000)), 32);
});

it("reads every test shard's wall time and ignores the other jobs", () => {
	const jobs = { jobs: [job("tests (1)", 300), job("lint", 900), job("tests (2)", 200), job("packed consumers (1)", 900)] };
	assert.deepEqual(testJobDurations(jobs, 2), [300_000, 200_000]);
	assert.throws(() => testJobDurations(jobs, 3), /every shard/u);
	assert.throws(() => testJobDurations({ jobs: [job("tests (1)", 300, "failure")] }, 1), /Invalid test job/u);
	assert.throws(() => testJobDurations({ jobs: [{ ...job("tests (1)", 300), "completed_at": null }] }, 1), /Invalid test job/u);
	assert.throws(() => testJobDurations({}, 1), /Invalid workflow jobs/u);
});

it("chooses the smallest balanced count within thirty seconds, rather than just dividing total work", () => {
	assert.equal(measuredShardCount(timings([20_000, 20_000, 20_000])), 3);
	assert.equal(measuredShardCount(timings([12_000, 10_000, 8000])), 1);
	assert.equal(measuredShardCount(timings([20_000, 20_000, 10_000, 10_000])), 2);
});

it("avoids chasing an indivisible slow file, caps growth, and falls back without measurements", () => {
	assert.equal(measuredShardCount(timings([90_000, 10_000, 10_000])), 2);
	assert.equal(measuredShardCount(timings(Array.from({ length: 100 }, () => 30_000))), 32);
	assert.equal(measuredShardCount([]), 8);
});

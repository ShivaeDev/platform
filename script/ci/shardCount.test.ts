import assert from "node:assert/strict";
import { test as it } from "node:test";
import { measuredShardCount } from "./shardCount.ts";

function timings(durations: number[]) {
	return durations.map((durationMs, index) => ({ durationMs, name: String(index) }));
}

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

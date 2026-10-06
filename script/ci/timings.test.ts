import assert from "node:assert/strict";
import { test as it } from "node:test";
import { balancedShards } from "./shard.ts";
import { decodeTimingSnapshot, durationEstimates, mergeConsumerTimingReports } from "./timings.ts";

it("merges complete main reports, balances measured work, and includes new packages", () => {
	const reports = [
		{ shard: { count: 2, index: 2 }, timings: [{ durationMs: 5000, name: "small" }] },
		{ shard: { count: 2, index: 1 }, timings: [{ durationMs: 20_000, name: "large" }] },
	];
	const snapshot = mergeConsumerTimingReports(reports, "42", "main-sha");
	assert.equal(snapshot.runId, "42");
	assert.equal(snapshot.sha, "main-sha");
	const estimates = durationEstimates(snapshot);
	const shards = balancedShards(
		["small", "new", "large"],
		2,
		(name) => name,
		(name) => estimates[name] ?? 6000,
	);
	assert.deepEqual(shards, [["large"], ["new", "small"]]);
	assert.deepEqual(snapshot, mergeConsumerTimingReports([...reports].reverse(), "42", "main-sha"));
});

it("rejects incomplete shards, duplicate packages, and invalid durations", () => {
	const report = { shard: { count: 2, index: 1 }, timings: [{ durationMs: 1000, name: "sample" }] };
	assert.throws(() => mergeConsumerTimingReports([report], "42", "sha"), /every shard/u);
	assert.throws(() => mergeConsumerTimingReports([report, report], "42", "sha"), /every shard/u);
	assert.throws(() => mergeConsumerTimingReports([report, { ...report, shard: { count: 2, index: 2 } }], "42", "sha"), /Duplicate/u);
	for (const durationMs of [-1, 0, Number.NaN, Number.POSITIVE_INFINITY, "1000"]) {
		assert.throws(() => decodeTimingSnapshot({ runId: "42", sha: "sha", timings: [{ durationMs, name: "sample" }] }), /Invalid/u);
	}
	assert.deepEqual(durationEstimates(decodeTimingSnapshot({ runId: "", sha: "", timings: [] })), {});
});

it("accepts legacy timing artifacts but rejects unsafe shard counts", () => {
	const snapshot = { runId: "42", sha: "main-sha", timings: [{ durationMs: 10_000, name: "file" }] };
	assert.equal(decodeTimingSnapshot(snapshot).shardCount, undefined);
	assert.equal(decodeTimingSnapshot({ ...snapshot, shardCount: 3 }).shardCount, 3);
	for (const shardCount of [0, -1, 1.5, 33, "8"]) {
		assert.throws(() => decodeTimingSnapshot({ ...snapshot, shardCount }), /Invalid shard count/u);
	}
});

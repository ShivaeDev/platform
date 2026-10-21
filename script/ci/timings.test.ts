import assert from "node:assert/strict";
import { planning } from "#ci/test-support/planning.ts";

planning.it("merges complete main reports, balances measured work, and includes new packages", [], ({ mergeReports, planMeasured }) => {
	const reports = [
		{ shard: { count: 2, index: 2 }, timings: [{ durationMs: 5000, name: "small" }] },
		{ shard: { count: 2, index: 1 }, timings: [{ durationMs: 20_000, name: "large" }] },
	];
	const snapshot = mergeReports(reports);
	assert.equal(snapshot.runId, "42");
	assert.equal(snapshot.sha, "main-sha");
	const shards = planMeasured(["small", "new", "large"], 2, snapshot);
	assert.deepEqual(shards, [["large"], ["new", "small"]]);
	assert.deepEqual(snapshot, mergeReports([...reports].reverse()));
});

planning.it("rejects incomplete shards, duplicate packages, and invalid durations", [], ({ mergeReports, readEstimates, readSnapshot }) => {
	const report = { shard: { count: 2, index: 1 }, timings: [{ durationMs: 1000, name: "sample" }] };
	assert.throws(() => mergeReports([report]), /every shard/u);
	assert.throws(() => mergeReports([report, report]), /every shard/u);
	assert.throws(() => mergeReports([report, { ...report, shard: { count: 2, index: 2 } }]), /Duplicate/u);
	for (const durationMs of [-1, 0, Number.NaN, Number.POSITIVE_INFINITY, "1000"]) {
		assert.throws(() => readSnapshot({ runId: "42", sha: "sha", timings: [{ durationMs, name: "sample" }] }), /Invalid/u);
	}
	assert.deepEqual(readEstimates(readSnapshot({ runId: "", sha: "", timings: [] })), {});
});

planning.it("accepts legacy timing artifacts but rejects unsafe shard counts", [], ({ readSnapshot }) => {
	const snapshot = { runId: "42", sha: "main-sha", timings: [{ durationMs: 10_000, name: "file" }] };
	assert.equal(readSnapshot(snapshot).shardCount, undefined);
	assert.equal(readSnapshot({ ...snapshot, shardCount: 3 }).shardCount, 3);
	for (const shardCount of [0, -1, 1.5, 33, "8"]) {
		assert.throws(() => readSnapshot({ ...snapshot, shardCount }), /Invalid shard count/u);
	}
});

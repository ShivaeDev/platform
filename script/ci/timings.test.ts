import { expect } from "vitest";
import { planning } from "#ci/test-support/planning.ts";

planning.it("merges complete main reports, balances measured work, and includes new packages", [], ({ mergeReports, planMeasured }) => {
	const reports = [
		{ shard: { count: 2, index: 2 }, timings: [{ durationMs: 5000, name: "small" }] },
		{ shard: { count: 2, index: 1 }, timings: [{ durationMs: 20_000, name: "large" }] },
	];
	const snapshot = mergeReports(reports);
	expect(snapshot.runId).toBe("42");
	expect(snapshot.sha).toBe("main-sha");
	const shards = planMeasured(["small", "new", "large"], 2, snapshot);
	expect(shards).toEqual([["large"], ["new", "small"]]);
	expect(snapshot).toEqual(mergeReports([...reports].reverse()));
});

planning.it("rejects incomplete shards, duplicate packages, and invalid durations", [], ({ mergeReports, readEstimates, readSnapshot }) => {
	const report = { shard: { count: 2, index: 1 }, timings: [{ durationMs: 1000, name: "sample" }] };
	expect(() => mergeReports([report])).toThrow(/every shard/u);
	expect(() => mergeReports([report, report])).toThrow(/every shard/u);
	expect(() => mergeReports([report, { ...report, shard: { count: 2, index: 2 } }])).toThrow(/Duplicate/u);
	for (const durationMs of [-1, 0, Number.NaN, Number.POSITIVE_INFINITY, "1000"]) {
		expect(() => readSnapshot({ runId: "42", sha: "sha", timings: [{ durationMs, name: "sample" }] })).toThrow(/Invalid/u);
	}
	expect(readEstimates(readSnapshot({ runId: "", sha: "", timings: [] }))).toEqual({});
});

planning.it("accepts legacy timing artifacts but rejects unsafe shard counts", [], ({ readSnapshot }) => {
	const snapshot = { runId: "42", sha: "main-sha", timings: [{ durationMs: 10_000, name: "file" }] };
	expect(readSnapshot(snapshot).shardCount).toBe(undefined);
	expect(readSnapshot({ ...snapshot, shardCount: 3 })).toMatchObject({ shardCount: 3 });
	for (const shardCount of [0, -1, 1.5, 33, "8"]) {
		expect(() => readSnapshot({ ...snapshot, shardCount })).toThrow(/Invalid shard count/u);
	}
});

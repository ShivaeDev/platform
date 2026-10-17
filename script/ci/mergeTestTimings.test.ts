import assert from "node:assert/strict";
import { test as it } from "node:test";
import { mergeTestTimings } from "./mergeTestTimings.ts";

function jobs(...seconds: number[]) {
	return {
		jobs: seconds.map((duration, index) => ({
			"completed_at": new Date(duration * 1000).toISOString(),
			conclusion: "success",
			name: `tests (${index + 1})`,
			"started_at": new Date(0).toISOString(),
		})),
	};
}

it("merges native Vitest results into portable project-aware timings sized by job wall time", () => {
	const reports = [
		JSON.stringify({ results: [["quality:unit:packages/quality/src/cli.test.ts", { duration: 20_000, failed: false }]], version: "4.1.11" }),
		JSON.stringify({ results: [["quality:dom:packages/quality/src/cli.test.ts", { duration: 5000, failed: false }]], version: "4.1.11" }),
	];
	const snapshot = mergeTestTimings(reports, jobs(300, 200), 2, "42", "main-sha");
	assert.equal(snapshot.runId, "42");
	assert.equal(snapshot.sha, "main-sha");
	assert.equal(snapshot.shardCount, 3);
	assert.deepEqual(
		snapshot.timings.map((item) => item.durationMs),
		[5000, 20_000],
	);
	assert.deepEqual(snapshot, mergeTestTimings([...reports].reverse(), jobs(300, 200), 2, "42", "main-sha"));
	assert.throws(() => mergeTestTimings(reports.slice(0, 1), jobs(300, 200), 2, "42", "main-sha"), /every shard/u);
	assert.throws(() => mergeTestTimings([reports[0] ?? "", reports[0] ?? ""], jobs(300, 200), 2, "42", "main-sha"), /Duplicate/u);
	assert.throws(() => mergeTestTimings(reports, jobs(300), 2, "42", "main-sha"), /every shard/u);
	const failed = JSON.stringify({ results: [["unit:failed.test.ts", { duration: 100, failed: true }]], version: "4.1.11" });
	assert.throws(() => mergeTestTimings([failed], jobs(300), 1, "42", "main-sha"), /Invalid successful/u);
});

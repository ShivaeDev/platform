import assert from "node:assert/strict";
import { test as it } from "node:test";
import { mergeTestTimings } from "./mergeTestTimings.ts";

it("merges native Vitest results into portable project-aware timings", () => {
	const reports = [
		JSON.stringify({ results: [["quality:unit:packages/quality/src/cli.test.ts", { duration: 20_000, failed: false }]], version: "4.1.11" }),
		JSON.stringify({ results: [["quality:dom:packages/quality/src/cli.test.ts", { duration: 5000, failed: false }]], version: "4.1.11" }),
	];
	const snapshot = mergeTestTimings(reports, 2, "42", "main-sha");
	assert.equal(snapshot.runId, "42");
	assert.equal(snapshot.sha, "main-sha");
	assert.deepEqual(
		snapshot.timings.map((item) => item.durationMs),
		[5000, 20_000],
	);
	assert.deepEqual(snapshot, mergeTestTimings([...reports].reverse(), 2, "42", "main-sha"));
	assert.throws(() => mergeTestTimings(reports.slice(0, 1), 2, "42", "main-sha"), /every shard/u);
	assert.throws(() => mergeTestTimings([reports[0] ?? "", reports[0] ?? ""], 2, "42", "main-sha"), /Duplicate/u);
	const failed = JSON.stringify({ results: [["unit:failed.test.ts", { duration: 100, failed: true }]], version: "4.1.11" });
	assert.throws(() => mergeTestTimings([failed], 1, "42", "main-sha"), /Invalid successful/u);
});

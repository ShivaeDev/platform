import assert from "node:assert/strict";
import { planning } from "#ci/test-support/planning.ts";
import { workflowJobs } from "#ci/test-support/workflowJobs.ts";

const completedTests = workflowJobs({ build: 900, "tests (1)": 300, "tests (2)": 200 });

planning.it("merges native Vitest results into portable project-aware timings sized by test wall time", [completedTests], ({ mergeTests }) => {
	const reports = [
		JSON.stringify({
			projects: { "quality:unit": { files: { "packages/quality/src/cli.test.ts": { duration: 20_000, failed: false } } } },
			version: 1,
		}),
		JSON.stringify({ projects: { "quality:dom": { files: { "packages/quality/src/cli.test.ts": { duration: 5000, failed: false } } } }, version: 1 }),
	];
	const snapshot = mergeTests(reports, 240_000);
	assert.equal(snapshot.runId, "42");
	assert.equal(snapshot.sha, "main-sha");
	assert.equal(snapshot.shardCount, 3);
	assert.equal(mergeTests(reports, 600_000).shardCount, 1);
	assert.deepEqual(
		snapshot.timings.map((item) => item.durationMs),
		[5000, 20_000],
	);
	assert.deepEqual(snapshot, mergeTests([...reports].reverse(), 240_000));
	assert.throws(() => mergeTests(reports.slice(0, 1), 240_000, 2), /every shard/u);
	assert.throws(() => mergeTests([reports[0] ?? "", reports[0] ?? ""], 240_000), /Duplicate/u);
	const failed = JSON.stringify({ projects: { unit: { files: { "failed.test.ts": { duration: 100, failed: true } } } }, version: 1 });
	assert.throws(() => mergeTests([failed], 240_000), /Invalid successful/u);
});

planning.it("requires timings for every test job", [workflowJobs({ "tests (1)": 300 })], ({ mergeTests }) => {
	const reports = ["unit", "dom"].map((project) =>
		JSON.stringify({ projects: { [project]: { files: { "sample.test.ts": { duration: 100, failed: false } } } }, version: 1 }),
	);
	assert.throws(() => mergeTests(reports, 240_000), /every/u);
});

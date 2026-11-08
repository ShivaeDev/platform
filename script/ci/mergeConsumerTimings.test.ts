import { expect } from "vitest";
import { planning } from "#ci/test-support/planning.ts";
import { workflowJobs } from "#ci/test-support/workflowJobs.ts";

const reports = [
	{ shard: { count: 2, index: 1 }, timings: [{ durationMs: 20_000, name: "large" }] },
	{ shard: { count: 2, index: 2 }, timings: [{ durationMs: 5000, name: "small" }] },
];

planning.it(
	"sizes consumer shards to finish with the tests after the build",
	[workflowJobs({ build: 150, "packed consumers (1)": 200, "packed consumers (2)": 160, "tests (1)": 900 })],
	({ mergeConsumers }) => {
		const snapshot = mergeConsumers(reports, 240_000);
		expect(snapshot).toMatchObject({ shardCount: 4 });
		expect(snapshot.timings.map((item) => item.name)).toEqual(["large", "small"]);
	},
);

planning.it(
	"reserves at least a minute for consumers after a slow build",
	[workflowJobs({ build: 230, "packed consumers (1)": 200, "packed consumers (2)": 160 })],
	({ mergeConsumers }) => {
		expect(mergeConsumers(reports, 240_000)).toMatchObject({ shardCount: 6 });
	},
);

planning.it("retains previous timings when build timings are unavailable", [workflowJobs({ "packed consumers (1)": 200 })], ({ mergeConsumers }) => {
	expect(mergeConsumers(reports, 240_000)).toEqual({ runId: "42", sha: "main-sha", timings: [] });
});

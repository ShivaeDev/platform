import { expect } from "vitest";
import { planning } from "#ci/test-support/planning.ts";
import { workflowJob } from "#ci/test-support/workflowJob.ts";
import { workflowJobs } from "#ci/test-support/workflowJobs.ts";

planning.it("sizes shards so the summed job wall time fills the target per shard", [], ({ countShards }) => {
	expect({
		beyondTheCap: countShards(
			Array.from({ length: 40 }, () => 240_000),
			240_000,
		),
		exactlyTwoTargets: countShards([240_000, 240_000], 240_000),
		justOverTwoTargets: countShards([240_000, 240_001], 240_000),
		oneLargeTarget: countShards([240_000, 240_001], 600_000),
		smallJob: countShards([1000], 240_000),
	}).toEqual({ beyondTheCap: 32, exactlyTwoTargets: 2, justOverTwoTargets: 3, oneLargeTarget: 1, smallJob: 1 });
	expect(() => countShards([1000], 0)).toThrow(/target/u);
});

planning.it("gives consumer shards what the target leaves after the build, but at least a minute", [], ({ consumerBudget }) => {
	expect({
		exactMinute: consumerBudget(240_000, 200_000),
		fastBuild: consumerBudget(240_000, 150_000),
		slowBuild: consumerBudget(240_000, 300_000),
	}).toEqual({ exactMinute: 60_000, fastBuild: 90_000, slowBuild: 60_000 });
});

planning.it(
	"reads every matching job's wall time and ignores the other jobs",
	[workflowJobs({ build: 150, "packed consumers (1)": 900, "tests (1)": 300, "tests (2)": 200 })],
	({ readJobs, readJobResponse }) => {
		expect(readJobs(/^tests \(\d+\)$/u, 2)).toEqual([300_000, 200_000]);
		expect(readJobs(/^build$/u, 1)).toEqual([150_000]);
		expect(readJobs(/^packed consumers \(\d+\)$/u, 1)).toEqual([900_000]);
		expect(() => readJobs(/^tests \(\d+\)$/u, 3)).toThrow(/every/u);
		expect(() => readJobResponse({ jobs: [workflowJob("tests (1)", 300, "failure")] }, /^tests \(\d+\)$/u, 1)).toThrow(/Invalid job/u);
		expect(() => readJobResponse({ jobs: [{ ...workflowJob("tests (1)", 300), "completed_at": null }] }, /^tests \(\d+\)$/u, 1)).toThrow(
			/Invalid job/u,
		);
		expect(() => readJobResponse({}, /^build$/u, 1)).toThrow(/Invalid workflow jobs/u);
	},
);

planning.it("reads the target from a repository variable in whole seconds", [], ({ readTarget }) => {
	expect({ targetMs: readTarget("240") }).toEqual({ targetMs: 240_000 });
	for (const value of [undefined, "", "0", "-1", "1.5", "four"]) {
		expect(() => readTarget(value)).toThrow(/target seconds/u);
	}
});
